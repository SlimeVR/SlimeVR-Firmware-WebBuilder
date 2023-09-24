import { Inject, Injectable } from '@nestjs/common';
import { CreateBuildFirmwareDTO } from './dto/build-firmware.dto';
import { BuildResponseDTO, BuildStatusMessage } from './dto/build-response.dto';
import { AVAILABLE_FIRMWARE_REPOS } from './firmware.constants';
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
import fs from 'fs';
import fetch from 'node-fetch';
import { exec, execSync } from 'child_process';
import { APP_CONFIG, ConfigService } from 'src/config/config.service';
import { BoardConfigDTO } from './dto/board-config.dto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { InjectAws } from 'aws-sdk-v3-nest';
import { IMUS } from './dto/imu.dto';

@Injectable()
export class FirmwareBuilderService {
  private readonly buildStatusSubject = new Subject<BuildStatusMessage>();

  constructor(
    @Inject(APP_CONFIG) private appConfig: ConfigService,
    @InjectAws(S3Client) private readonly s3: S3Client,
    private githubService: GithubService,
    private prisma: PrismaService,
  ) {}

  /**
   * Returns the content of the define.h based on the board config and imus config
   */
  public getDefines(boardConfig: BoardConfigDTO, imusConfig: ImuConfig[]) {
    const rotationToFirmware = function (rotation: number): number {
      // Reduce the angle to its lowest equivalent form,
      // negate it to match the firmware rotation direction,
      // then convert it to radians
      return (-(rotation % 360) / 180) * Math.PI;
    };

    /**
     * Define of one imu entry, computes the address
     */
    const imuDesc = (imuConfig, index) => {
      const imu = IMUS.find(({ type }) => type === imuConfig.type);

      return `IMU_DESC_ENTRY(${imuConfig.type}, ${
        (imu?.imuStartAddress || 0x69) + index * (imu?.addressIncrement || 1)
      }, ${rotationToFirmware(imuConfig.rotation)}, ${imuConfig.sclPin}, ${
        imuConfig.sdaPin
      }, ${imuConfig.intPin || 255})`;
    };

    // this is to deal with old firmware versions where two imus where always declared
    // i just use the values of the first one if i only have one
    const secondImu = imusConfig.length === 1 ? imusConfig[0] : imusConfig[1];

    return `
          #define IMU ${imusConfig[0].type}
          #define SECOND_IMU ${secondImu.type}
          #define BOARD ${boardConfig.type}
          #define IMU_ROTATION ${rotationToFirmware(imusConfig[0].rotation)}
          #define SECOND_IMU_ROTATION ${rotationToFirmware(secondImu.rotation)}

          #define MAX_IMU_COUNT ${imusConfig.length}

          #ifndef IMU_DESC_LIST
          #define IMU_DESC_LIST \\
                ${imusConfig.map(imuDesc).join(' \\\n\t\t ')}
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
          buildStatus: { not: 'FAILED' },
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
        if (firmware.buildStatus === BuildStatus.BUILDING) {
          return new BuildResponseDTO(firmware.id, firmware.buildStatus);
        }

        if (firmware.buildStatus === BuildStatus.DONE) {
          return new BuildResponseDTO(
            firmware.id,
            firmware.buildStatus,
            firmware.firmwareFiles,
          );
        }

        // We probably should to better error messages here
        throw new VersionNotFoundExeption();
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
    if (!firmware.boardConfig)
      throw new Error('invalid state, the firmware entry has no board config');

    let tmpDir;

    try {
      this.buildStatusSubject.next(
        new BuildStatusMessage(
          firmware.id,
          BuildStatus.BUILDING,
          'Creating temporary build folder',
        ),
      );

      tmpDir = await mkdtemp(path.join(os.tmpdir(), 'slimevr-api'));

      const releaseFileName = `release-${release.name.replace(
        /[^A-Za-z0-9. ]/gi,
        '_',
      )}.zip`;
      const releaseFilePath = path.join(tmpDir, releaseFileName);

      const downloadFile = async (url: string, path: string) => {
        const res = await fetch(url);
        const fileStream = fs.createWriteStream(path);
        await new Promise((resolve, reject) => {
          res.body.pipe(fileStream);
          res.body.on('error', reject);
          fileStream.on('finish', resolve);
        });
      };

      this.buildStatusSubject.next(
        new BuildStatusMessage(
          firmware.id,
          BuildStatus.BUILDING,
          'Downloading SlimeVR firmware from Github',
        ),
      );

      await downloadFile(release.zipball_url, releaseFilePath);

      this.buildStatusSubject.next(
        new BuildStatusMessage(
          firmware.id,
          BuildStatus.BUILDING,
          'Extracting firmware',
        ),
      );

      const releaseFolderPath = path.join(tmpDir, `release-${release.name}`);
      const zip = new AdmZip(releaseFilePath);
      // Extract release
      console.log('start extract', releaseFilePath, releaseFolderPath);
      await new Promise((resolve) => {
        zip.extractAllTo(releaseFolderPath, true);
        resolve(true);
      });

      this.buildStatusSubject.next(
        new BuildStatusMessage(
          firmware.id,
          BuildStatus.BUILDING,
          'Setting up defines and configs',
        ),
      );

      const [root] = await readdir(releaseFolderPath);
      const rootFoler = path.join(releaseFolderPath, root);

      const definesContent = this.getDefines(
        firmware.boardConfig,
        firmware.imusConfig,
      );
      console.log(definesContent);
      const res = await Promise.all([
        writeFile(path.join(rootFoler, 'src', 'defines.h'), definesContent),
      ]);

      await rm(join(rootFoler, 'platformio.ini'));
      await rename(
        join(rootFoler, 'platformio-tools.ini'),
        join(rootFoler, 'platformio.ini'),
      );

      console.log(res);

      this.buildStatusSubject.next(
        new BuildStatusMessage(
          firmware.id,
          BuildStatus.BUILDING,
          'Building Firmware (this might take a minute)',
        ),
      );

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

          console.log('[BUILD LOG]', `[${firmware.id}]`, data.toString());
          this.buildStatusSubject.next(
            new BuildStatusMessage(
              firmware.id,
              BuildStatus.BUILDING,
              'Building Firmware (this might take a minute)',
            ),
          );
        });

        platformioRun.stderr?.on('data', (data) => {
          if (!firmware.boardConfig)
            throw new Error(
              'invalid state, the firmware entry has no board config',
            );

          console.log('[BUILD LOG]', `[${firmware.id}]`, data.toString());
        });

        platformioRun.on('exit', (code) => {
          if (code === 0) {
            resolve(true);
          } else reject({ message: 'bad exit code' });
        });
      });

      this.buildStatusSubject.next(
        new BuildStatusMessage(
          firmware.id,
          BuildStatus.BUILDING,
          'Uploading Firmware to Bucket',
        ),
      );

      const files = await this.getPartitions(
        firmware.boardConfig.type,
        rootFoler,
      );

      await Promise.all(
        files.map(async ({ path }, index) =>
          this.uploadFirmware(
            firmware.id,
            `firmware-part-${index}.bin`,
            await readFile(path),
          ),
        ),
      );

      const firmwareFiles = files.map(({ offset }, index) => ({
        offset,
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

      this.buildStatusSubject.next(
        new BuildStatusMessage(
          firmware.id,
          BuildStatus.DONE,
          'Build complete',
          firmwareFiles.map((file) => ({
            ...file,
            firmwareId: firmware.id,
          })),
        ),
      );
    } catch (e) {
      console.log(e);
      this.buildStatusSubject.next(
        new BuildStatusMessage(
          firmware.id,
          BuildStatus.FAILED,
          `Build failed: ${e.message || e}`,
        ),
      );
      await this.prisma.firmware.update({
        where: { id: firmware.id },
        data: { buildStatus: BuildStatus.FAILED },
      });
    } finally {
      try {
        if (tmpDir) {
          await rm(tmpDir, { recursive: true });
        }
      } catch (e) {
        console.error(
          `An error has occurred while removing the temp folder at ${tmpDir}. Please remove it manually. Error: ${e}`,
        );
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
  ): Promise<{ path: string; offset: number }[]> {
    const ideInfos = (await new Promise((resolve) => {
      const metadata = execSync(
        `platformio project metadata --json-output -e ${boardType}`,
        {
          cwd: rootFoler,
          shell: '/bin/bash',
        },
      );
      resolve(JSON.parse(metadata.toString()));
    })) as {
      [key: string]: {
        extra: {
          flash_images: { offset: string; path: string }[];
          application_offset: string;
        };
      };
    };

    return [
      ...ideInfos[boardType].extra.flash_images.map(
        ({ offset, ...fields }) => ({ offset: parseInt(offset), ...fields }),
      ),
      {
        path: join(rootFoler, `.pio/build/${boardType}/firmware.bin`),
        offset: parseInt(ideInfos[boardType].extra.application_offset),
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
