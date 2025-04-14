import { Inject, Injectable } from '@nestjs/common';
import { CreateBuildFirmwareDTO } from './dto/build-firmware.dto';
import { BuildResponseDTO } from './dto/build-response.dto';
import {
  AVAILABLE_BOARDS,
  AVAILABLE_FIRMWARE_REPOS,
} from './firmware.constants';
import { GithubService } from 'src/github/github.service';
import { PrismaService } from 'src/commons/prisma/prisma.service';
import {
  BatteryType,
  BoardType,
  BuildStatus,
  ImuConfig,
  Prisma,
} from '@prisma/client';
import { VersionNotFoundExeption } from './errors/version-not-found.error';
import { Subject, debounceTime, filter, map } from 'rxjs';
import { ReleaseDTO } from 'src/github/dto/release.dto';
import { mkdtemp, readdir, readFile, rename, rm, writeFile } from 'fs/promises';
import path, { join } from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import { exec, execSync } from 'child_process';
import { APP_CONFIG, ConfigService } from 'src/config/config.service';
import { BoardConfigDTO } from './dto/board-config.dto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { InjectAws } from 'aws-sdk-v3-nest';
import { IMUS } from './dto/imu.dto';
import { captureException, getCurrentScope } from '@sentry/nestjs';

@Injectable()
export class FirmwareBuilderService {
  private readonly buildStatusSubject = new Subject<BuildResponseDTO>();

  constructor(
    @Inject(APP_CONFIG) private appConfig: ConfigService,
    @InjectAws(S3Client) private readonly s3: S3Client,
    private githubService: GithubService,
    private prisma: PrismaService,
  ) {}

  /**
   * Returns the content of the define.h based on the board config and imus config
   */
  public getDefines(
    version: string,
    boardConfig: BoardConfigDTO,
    imusConfig: ImuConfig[],
  ) {
    const rotationToFirmware = (rotation: number): number => {
      // Reduce the angle to its lowest equivalent form,
      // negate it to match the firmware rotation direction,
      // then convert it to radians
      return (-(rotation % 360) / 180) * Math.PI;
    };

    /**
     * Define of one imu entry, computes the address
     */
    const imuDesc = (imuConfig: ImuConfig, index: number) => {
      const imu = IMUS.find(({ type }) => type === imuConfig.type);
      if (!imu) return null;

      return `IMU_DESC_ENTRY(${imuConfig.type}, ${
        imu.imuStartAddress + index * imu.addressIncrement
      }, ${rotationToFirmware(imuConfig.rotation)}, ${imuConfig.sclPin}, ${
        imuConfig.sdaPin
      }, ${imuConfig.optional}, ${imuConfig.intPin || 255})`;
    };

    /**
     * Define of one sensor entry, computes the address
     * For 0.6.0+ firmware versions
     */
    const sensorDesc = (imuConfig: ImuConfig, index: number) => {
      const imu = IMUS.find(({ type }) => type === imuConfig.type);
      if (!imu) return null;

      return `SENSOR_DESC_ENTRY(${imuConfig.type}, ${
        imu.imuStartAddress + index * imu.addressIncrement
      }, ${rotationToFirmware(imuConfig.rotation)}, DIRECT_WIRE(${
        imuConfig.sclPin
      }, ${imuConfig.sdaPin}), ${imuConfig.optional}, DIRECT_PIN(${
        imuConfig.intPin || 255
      }))`;
    };

    // this is to deal with old firmware versions where two imus where always declared
    // i just use the values of the first one if i only have one
    const secondImu = imusConfig.length === 1 ? imusConfig[0] : imusConfig[1];

    const fwVersion = version.startsWith('SlimeVR/')
      ? version.substring('SlimeVR/v'.length)
      : version;

    return `
          #define FIRMWARE_VERSION "${fwVersion}"

          #define IMU ${imusConfig[0].type}
          #define SECOND_IMU ${secondImu.type}
          #define BOARD ${boardConfig.type}
          #define IMU_ROTATION ${rotationToFirmware(imusConfig[0].rotation)}
          #define SECOND_IMU_ROTATION ${rotationToFirmware(secondImu.rotation)}

          #define MAX_IMU_COUNT ${imusConfig.length}
          #define MAX_SENSORS_COUNT ${imusConfig.length}
          // Make sure the Tracker is defined as Rotating (TrackerType::TRACKER_TYPE_SVR_ROTATION) 
          // (will need to be changed for glove left / right) Static number to support older FW Builds
          #define TRACKER_TYPE 0

          #ifndef IMU_DESC_LIST
          #define IMU_DESC_LIST \\
                ${imusConfig
                  .map(imuDesc)
                  .filter((imu) => !!imu)
                  .join(' \\\n\t\t ')}
          #endif

          #ifndef SENSOR_DESC_LIST
          #define SENSOR_DESC_LIST \\
                ${imusConfig
                  .map(sensorDesc)
                  .filter((imu) => !!imu)
                  .join(' \\\n\t\t ')}
          #endif

          #ifndef SENSOR_INFO_LIST
          #define SENSOR_INFO_LIST
          #endif

          #define BATTERY_MONITOR ${boardConfig.batteryType}
          ${
            boardConfig.batteryType === BatteryType.BAT_EXTERNAL &&
            `
          #define PIN_BATTERY_LEVEL ${boardConfig.batteryPin}
          #define BATTERY_SHIELD_RESISTANCE ${boardConfig.batteryResistances[0]}
          #define BATTERY_SHIELD_R1 ${boardConfig.batteryResistances[1]}
          #define BATTERY_SHIELD_R2 ${boardConfig.batteryResistances[2]}
          `
          }
    
          #define PIN_IMU_SDA ${imusConfig[0].sdaPin}
          #define PIN_IMU_SCL ${imusConfig[0].sclPin}
          #define PIN_IMU_INT ${imusConfig[0].intPin || 255}
          #define PIN_IMU_INT_2 ${secondImu.intPin || 255}
          #define LED_BUILTIN ${boardConfig.ledPin}
          #define LED_INVERTED ${boardConfig.ledInverted}
          #define LED_PIN ${boardConfig.enableLed ? boardConfig.ledPin : 255}
        `;
  }

  /**
   * Build a firmware according to the specified config
   */
  public async buildFirmware(
    dto: CreateBuildFirmwareDTO,
  ): Promise<BuildResponseDTO> {
    try {
      const [, owner, version] = dto.version.match(/(.*?)\/(.*)/) || [
        undefined,
        'SlimeVR',
        dto.version,
      ];
      let repo = 'SlimeVR-Tracker-ESP';

      // TODO: Make the site say what repo to use, please
      // If there's a matching owner
      const ownerRepos = AVAILABLE_FIRMWARE_REPOS[owner];
      if (ownerRepos !== undefined) {
        for (const [repoToSearch, branches] of Object.entries(ownerRepos)) {
          // And a matching branch
          if (Array.isArray(branches) && branches.includes(version)) {
            // This is the target repo *probably*
            repo = repoToSearch;
            break;
          }
        }
      }

      const release = await this.githubService.getRelease(owner, repo, version);

      const firmware = await this.prisma.firmware.findFirst({
        where: {
          releaseId: release.id,
          buildStatus: { not: 'ERROR' },
          boardConfig: {
            ...dto.boardConfig,
            batteryResistances: {
              equals: dto.boardConfig.batteryResistances,
            },
          },
          imusConfig: {
            // This might not be really efficient if we have many imus on one firmware
            // one solution could be to have a hash off all the imus value and use it as a key instead
            // but as for now the current solution is still fast enough
            every: { OR: dto.imusConfig },
          },
        },
        include: { firmwareFiles: true },
      });

      // If we found a firmware that match the config, we just return it without building again
      if (firmware) {
        switch (firmware.buildStatus) {
          case BuildStatus.DONE: {
            return new BuildResponseDTO(
              firmware.id,
              firmware.buildStatus,
              firmware.firmwareFiles,
            );
          }
          default: {
            return new BuildResponseDTO(firmware.id, firmware.buildStatus);
          }
        }
      } else {
        const newFirmware = await this.prisma.firmware.create({
          data: {
            buildStatus: BuildStatus.BUILDING,
            releaseId: release.id,
            boardConfig: {
              create: dto.boardConfig,
            },
            buildVersion: dto.version,
            imusConfig: {
              create: dto.imusConfig,
            },
          },
          include: { imusConfig: true, boardConfig: true },
        });

        this.startBuildingTask(newFirmware, release);
        return new BuildResponseDTO(newFirmware.id, newFirmware.buildStatus);
      }
    } catch (e) {
      throw new VersionNotFoundExeption();
    }
  }

  /**
   * Build the firmware
   * this function spawns the platformio build process and notify the user about the progress
   */
  private async startBuildingTask(
    firmware: Readonly<
      Prisma.FirmwareGetPayload<{
        include: { boardConfig: true; imusConfig: true };
      }>
    >,
    release: ReleaseDTO,
  ) {
    const logs: string[] = [];

    if (!firmware.boardConfig)
      throw new Error('invalid state, the firmware entry has no board config');

    const definesContent = this.getDefines(
      firmware.buildVersion,
      firmware.boardConfig,
      firmware.imusConfig,
    );

    let tmpDir;

    try {
      this.buildStatusSubject.next({
        id: firmware.id,
        status: BuildStatus.CREATING_BUILD_FOLDER,
      });

      tmpDir = await mkdtemp(path.join(os.tmpdir(), 'slimevr-api'));

      const releaseFileName = `release-${release.name.replace(
        /[^A-Za-z0-9. ]/gi,
        '_',
      )}.zip`;
      const releaseFilePath = path.join(tmpDir, releaseFileName);

      const downloadFile = async (url: string, path: string) =>
        fetch(url)
          .then((x) => x.arrayBuffer())
          .then((x) => writeFile(path, Buffer.from(x)));

      this.buildStatusSubject.next({
        id: firmware.id,
        status: BuildStatus.DOWNLOADING_FIRMWARE,
      });

      await downloadFile(release.zipball_url, releaseFilePath);

      this.buildStatusSubject.next({
        id: firmware.id,
        status: BuildStatus.EXTRACTING_FIRMWARE,
      });

      const releaseFolderPath = path.join(tmpDir, `release-${release.name}`);
      const zip = new AdmZip(releaseFilePath);
      await new Promise((resolve) => {
        zip.extractAllTo(releaseFolderPath, true);
        resolve(true);
      });

      this.buildStatusSubject.next({
        id: firmware.id,
        status: BuildStatus.SETTING_UP_DEFINES,
      });

      const [root] = await readdir(releaseFolderPath);
      const rootFoler = path.join(releaseFolderPath, root);

      await writeFile(path.join(rootFoler, 'src', 'defines.h'), definesContent);
      await rm(join(rootFoler, 'platformio.ini'));
      await rename(
        join(rootFoler, 'platformio-tools.ini'),
        join(rootFoler, 'platformio.ini'),
      );

      this.buildStatusSubject.next({
        id: firmware.id,
        status: BuildStatus.BUILDING,
      });

      await new Promise((resolve, reject) => {
        if (!firmware.boardConfig) {
          reject('invalid state, the firmware entry has no board config');
          return;
        }
        const platformioRun = exec(
          `platformio run -e ${firmware.boardConfig.type}`,
          {
            cwd: rootFoler,
            env: {
              // Keep existing variables
              ...process.env,
              // Git commit hash or release tag
              GIT_REV: release.id,
            },
          },
        );

        platformioRun.stdout?.on('data', (data) => {
          if (!firmware.boardConfig)
            throw new Error(
              'invalid state, the firmware entry has no board config',
            );

          logs.push(data.toString());
          // console.log('[BUILD LOG]', `[${firmware.id}]`, data.toString());
          this.buildStatusSubject.next({
            id: firmware.id,
            status: BuildStatus.BUILDING,
          });
        });

        platformioRun.stderr?.on('data', (data) => {
          if (!firmware.boardConfig)
            throw new Error(
              'invalid state, the firmware entry has no board config',
            );
          logs.push(`[ERR] ${data.toString()}`);
          // console.log('[BUILD LOG]', `[${firmware.id}]`, data.toString());
        });

        platformioRun.on('exit', (code) => {
          if (code === 0) {
            resolve(true);
          } else reject({ message: 'bad exit code' });
        });
      });

      this.buildStatusSubject.next({
        id: firmware.id,
        status: BuildStatus.SAVING,
      });

      const files = await this.getPartitions(
        firmware.boardConfig.type,
        rootFoler,
      );

      await Promise.all([
        ...files.map(async ({ path }, index) =>
          this.uploadFirmware(
            firmware.id,
            `firmware-part-${index}.bin`,
            await readFile(path),
          ),
        ),
        // Also add defines.h file to the bucket for debugging
        this.uploadFirmware(
          firmware.id,
          `defines.h`,
          Buffer.from(definesContent, 'utf-8'),
        ),
      ]);

      const firmwareFiles = files.map(({ offset, isFirmware }, index) => ({
        offset,
        isFirmware,
        url: `${this.appConfig.getBuildsBucket()}/${
          firmware.id
        }/firmware-part-${index}.bin`,
      }));
      await this.prisma.firmware.update({
        where: { id: firmware.id },
        data: {
          buildStatus: BuildStatus.DONE,
          firmwareFiles: {
            createMany: {
              data: firmwareFiles,
            },
          },
        },
      });

      this.buildStatusSubject.next({
        id: firmware.id,
        status: BuildStatus.DONE,
        firmwareFiles: firmwareFiles.map((file) => ({
          ...file,
          firmwareId: firmware.id,
        })),
      });
    } catch (e) {
      getCurrentScope().addAttachment({
        filename: 'pio-logs.txt',
        data: logs.join(''),
      });
      getCurrentScope().addAttachment({
        filename: 'defines.h',
        data: definesContent,
      });
      captureException(e);
      this.buildStatusSubject.next({
        id: firmware.id,
        status: BuildStatus.ERROR,
      });
      await this.prisma.firmware.update({
        where: { id: firmware.id },
        data: { buildStatus: BuildStatus.ERROR },
      });
    } finally {
      if (tmpDir) {
        await rm(tmpDir, { recursive: true });
      }
    }
  }

  /**
   * Upload the firmware file to a s3 bucket
   */
  private uploadFirmware(id: string, name: string, buffer: Buffer) {
    const upload = new PutObjectCommand({
      Bucket: this.appConfig.getBuildsBucket(),
      Key: path.join(id, name),
      Body: buffer,
    });
    return this.s3.send(upload);
  }

  /**
   * Get the board partitions infos
   */
  private async getPartitions(
    boardType: BoardType,
    rootFoler: string,
  ): Promise<{ path: string; offset: number; isFirmware: boolean }[]> {
    const ideInfos = (await new Promise((resolve) => {
      const metadata = execSync(
        `platformio project metadata --json-output -e ${boardType}`,
        {
          cwd: rootFoler,
          shell: '/bin/bash',
        },
      );
      console.log(metadata.toString());
      resolve(JSON.parse(metadata.toString()));
    })) as {
      [key: string]: {
        extra: {
          flash_images: { offset: string; path: string }[];
          application_offset?: string;
        };
      };
    };
    return [
      ...ideInfos[boardType].extra.flash_images.map(
        ({ offset, ...fields }) => ({
          offset: parseInt(offset),
          isFirmware: false,
          ...fields,
        }),
      ),
      {
        path: join(rootFoler, `.pio/build/${boardType}/firmware.bin`),
        offset: AVAILABLE_BOARDS[boardType].application_offset,
        isFirmware: true,
      },
    ];
  }

  /**
   * Subject with the build status, this gives the current status of a build from its id
   */
  public getBuildStatusSubject(id: string) {
    return this.buildStatusSubject.asObservable().pipe(
      filter((status) => status.id === id),
      map((event) => ({ data: event })),
      debounceTime(500),
    );
  }
}
