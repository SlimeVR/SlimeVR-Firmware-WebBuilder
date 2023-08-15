import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ReleaseDTO } from 'src/github/dto/release.dto';
import { GithubService } from 'src/github/github.service';
import { BuildResponseDTO, BuildStatusMessage } from './dto/build-response.dto';
import { VersionNotFoundExeption } from './errors/version-not-found.error';
import os from 'os';
import fs from 'fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import path, { join } from 'path';
import AdmZip from 'adm-zip';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { APP_CONFIG, ConfigService } from 'src/config/config.service';
import { debounceTime, filter, map, Subject } from 'rxjs';
import {
  AVAILABLE_FIRMWARE_REPOS,
  AVAILABLE_BOARDS,
} from './firmware.constants';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { InjectAws } from 'aws-sdk-v3-nest';
import { PrismaService } from 'src/commons/prisma/prisma.service';

import {
  BatteryType,
  BoardType,
  BuildStatus,
  Firmware,
  ImuConfig,
  Prisma,
} from '@prisma/client';
import { CreateBuildFirmwareDTO } from './dto/build-firmware.dto';
import { BoardConfigDTO } from './dto/board-config.dto';

@Injectable()
export class FirmwareService implements OnApplicationBootstrap {
  private readonly buildStatusSubject = new Subject<BuildStatusMessage>();

  constructor(
    @Inject(APP_CONFIG) private appConfig: ConfigService,
    @InjectAws(S3Client) private readonly s3: S3Client,
    private githubService: GithubService,
    private prisma: PrismaService,
  ) { }

  public getFirmwares(): Promise<Firmware[]> {
    return this.prisma.firmware.findMany({ where: { buildStatus: 'DONE' } });
  }

  public getFirmware(id: string): Promise<Firmware> {
    return this.prisma.firmware.findFirstOrThrow({
      where: { id },
      include: { boardConfig: true, imusConfig: true },
    });
  }

  /**
   * 
   * Fetch all the releases of all the firmware repositories
   * 
   * @returns ReleaseDTO[] a list of all the releases
   */
  async getAllReleases(): Promise<ReleaseDTO[]> {
    const releases: Promise<ReleaseDTO | ReleaseDTO[]>[] = [];

    for (const [owner, repos] of Object.entries(AVAILABLE_FIRMWARE_REPOS)) {
      for (const [repo, branches] of Object.entries(repos)) {
        // Get all repo releases
        releases.push(
          this.githubService.getReleases(owner, repo).catch((e) => {
            throw new Error(`Unable to fetch releases for "${owner}/${repo}"`, {
              cause: e,
            });
          }),
        );

        // Get each branch as a release version
        for (const branch of branches) {
          releases.push(
            this.githubService.getBranchRelease(owner, repo, branch).catch((e) => {
              throw new Error(
                `Unable to fetch branch release for "${owner}/${repo}/${branch}"`,
                { cause: e },
              );
            }),
          );
        }
      }
    }

    const settled = await Promise.allSettled(releases);
    return settled.flatMap((it) => {
      if (it.status === 'fulfilled') {
        return it.value;
      }
      console.warn(`${it.reason.message}: `, it.reason.cause);
      return []; // Needed for filtering invalid promises
    });
  }

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
        where: { releaseId: release.id, buildStatus: { not: 'FAILED' } }, // TODO missing build config
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
        throw VersionNotFoundExeption;
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
      throw VersionNotFoundExeption;
    }
  }

  public getDefines(boardConfig: BoardConfigDTO, imusConfig: ImuConfig[]) {
    const rotationToFirmware = function (rotation: number): number {
      // Reduce the angle to its lowest equivalent form,
      // negate it to match the firmware rotation direction,
      // then convert it to radians
      return (-(rotation % 360) / 180) * Math.PI;
    };

    // this is to deal with old firmware versions where two imus where always declared
    // i just use the values of the first one if i only have one
    const secondImu = imusConfig.length === 1 ? imusConfig[0] : imusConfig[2];

    return `
      #define IMU ${imusConfig[0].type}
      #define SECOND_IMU ${secondImu.type}
      #define BOARD ${boardConfig.type}
      #define IMU_ROTATION ${rotationToFirmware(imusConfig[0].rotation)}
      #define SECOND_IMU_ROTATION ${rotationToFirmware(secondImu.rotation)}

      #define BATTERY_MONITOR ${boardConfig.type}
      ${boardConfig.batteryType === BatteryType.BAT_EXTERNAL &&
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

  public getBuildStatusSubject(id: string) {
    return this.buildStatusSubject.asObservable().pipe(
      filter((status) => status.id === id),
      map((event) => ({ data: event })),
      debounceTime(500),
    );
  }

  public async onApplicationBootstrap() {
    await this.prisma.firmware.updateMany({
      where: { buildStatus: 'BUILDING' },
      data: { buildStatus: 'FAILED' },
    });
    this.cleanAllOldReleases();
    setInterval(() => {
      this.cleanAllOldReleases();
    }, 5 * 60 * 1000).unref();
  }

  public async cleanAllOldReleases() {
    for (const [owner, repos] of Object.entries(AVAILABLE_FIRMWARE_REPOS)) {
      for (const [repo, branches] of Object.entries(repos)) {
        for (const branch of branches) {
          this.cleanOldReleases(owner, repo, branch);
        }
      }
    }
  }

  public async cleanOldReleases(
    owner = 'SlimeVR',
    repo = 'SlimeVR-Tracker-ESP',
    branch = 'main',
  ): Promise<void> {
    const branchRelease = await this.githubService.getRelease(
      owner,
      repo,
      branch,
    );

    if (!branchRelease) return;

    const oldFirmwares = await this.prisma.firmware.findMany({
      where: {
        releaseId: { not: branchRelease.id },
        buildVersion: branchRelease.name,
      },
    });

    oldFirmwares.forEach(async (firmware) => {
      await this.prisma.firmware.delete({
        where: { id: firmware.id },
      });
      await this.emptyS3Directory(
        this.appConfig.getBuildsBucket(),
        `${firmware.id}`,
      );
      console.log('deleted firmware id:', firmware.id);
    });
  }

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
      this.buildStatusSubject.next({
        status: BuildStatus.BUILDING,
        id: firmware.id,
        message: 'Creating temporary build folder',
      });

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

      this.buildStatusSubject.next({
        status: BuildStatus.BUILDING,
        id: firmware.id,
        message: 'Downloading SlimeVR firmware from Github',
      });

      await downloadFile(release.zipball_url, releaseFilePath);

      this.buildStatusSubject.next({
        status: BuildStatus.BUILDING,
        id: firmware.id,
        message: 'Extracting firmware',
      });

      const releaseFolderPath = path.join(tmpDir, `release-${release.name}`);
      const zip = new AdmZip(releaseFilePath);
      // Extract release
      console.log('start extract', releaseFilePath, releaseFolderPath);
      await new Promise((resolve) => {
        zip.extractAllTo(releaseFolderPath, true);
        resolve(true);
      });

      this.buildStatusSubject.next({
        status: BuildStatus.BUILDING,
        id: firmware.id,
        message: 'Setting up defines and configs',
      });

      const [root] = await readdir(releaseFolderPath);
      const rootFoler = path.join(releaseFolderPath, root);

      const definesContent = this.getDefines(
        firmware.boardConfig,
        firmware.imusConfig,
      );
      console.log(definesContent);
      await Promise.all([
        writeFile(path.join(rootFoler, 'src', 'defines.h'), definesContent),
      ]);

      this.buildStatusSubject.next({
        status: BuildStatus.BUILDING,
        id: firmware.id,
        message: 'Building Firmware (this might take a minute)',
      });

      await new Promise((resolve, reject) => {
        if (!firmware.boardConfig) {
          reject('invalid state, the firmware entry has no board config');
          return;
        }
        const platformioRun = exec(
          `platformio run -e ${firmware.boardConfig.type} -c platformio-tools.ini`,
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
          this.buildStatusSubject.next({
            status: BuildStatus.BUILDING,
            id: firmware.id,
            message: 'Building Firmware (this might take a minute)',
          });
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

      this.buildStatusSubject.next({
        status: BuildStatus.BUILDING,
        id: firmware.id,
        message: 'Uploading Firmware to Bucket',
      });

      const files = this.getPartitions(firmware.boardConfig.type, rootFoler);

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
        url: `${this.appConfig.getBuildsBucket()}/${firmware.id
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
        status: BuildStatus.DONE,
        id: firmware.id,
        message: 'Build complete',
        firmwareFiles: firmwareFiles.map((file) => ({
          ...file,
          firmwareId: firmware.id,
        })),
      });
    } catch (e) {
      console.log(e);
      this.buildStatusSubject.next({
        status: BuildStatus.FAILED,
        id: firmware.id,
        message: `Build failed: ${e.message || e}`,
      });
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

  public getBoardDefaults(boardType: BoardType) {
    return AVAILABLE_BOARDS[boardType].defaults;
  }

  private getPartitions(
    boardType: BoardType,
    rootFoler: string,
  ): { path: string; offset: number }[] {
    return AVAILABLE_BOARDS[boardType].partitions.map(
      ({ path, ...fields }) => ({ ...fields, path: join(rootFoler, path) }),
    );
  }

  public async emptyS3Directory(bucket, dir) {
    const listObjectsV2 = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: dir,
    });

    const listedObjects = await this.s3.send(listObjectsV2);

    if (!listedObjects.Contents || listedObjects.Contents.length === 0) return;

    const deleteParams = {
      Bucket: bucket,
      Delete: { Objects: listedObjects.Contents.map(({ Key }) => ({ Key })) },
    };

    await this.s3.send(new DeleteObjectsCommand(deleteParams));

    if (listedObjects.IsTruncated) await this.emptyS3Directory(bucket, dir);
  }

  uploadFirmware(id: string, name: string, buffer: Buffer) {
    const upload = new PutObjectCommand({
      Bucket: this.appConfig.getBuildsBucket(),
      Key: path.join(id, name),
      Body: buffer,
    });
    return this.s3.send(upload);
  }

  public getFirmwareLink(id: string) {
    return `${this.appConfig.getS3Endpoint()}/${this.appConfig.getBuildsBucket()}/${id}/firmware.bin`;
  }
}
