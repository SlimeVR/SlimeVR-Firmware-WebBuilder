import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ReleaseDTO } from 'src/github/dto/release.dto';
import { GithubService } from 'src/github/github.service';
import { BuildFirmwareDTO } from './dto/build-firmware.dto';
import { BuildResponse } from './dto/build-response.dto';
import { BuildStatus, Firmware } from './entity/firmware.entity';
import { VersionNotFoundExeption } from './errors/version-not-found.error';
import os from 'os';
import fs from 'fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import path, { join } from 'path';
import AdmZip from 'adm-zip';
import fetch from 'node-fetch';
import { BoardType } from './dto/firmware-board.dto';
import { exec } from 'child_process';
import { Not } from 'typeorm';
import { APP_CONFIG, ConfigService } from 'src/config/config.service';
import { debounceTime, filter, map, Subject } from 'rxjs';
import { BuildStatusMessage } from './dto/build-status-message.dto';
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

@Injectable()
export class FirmwareService implements OnApplicationBootstrap {
  private readonly buildStatusSubject = new Subject<BuildStatusMessage>();

  constructor(
    @InjectAws(S3Client) private readonly s3: S3Client,
    private githubService: GithubService,
    @Inject(APP_CONFIG) private appConfig: ConfigService,
  ) {}

  public getFirmwares(): Promise<Firmware[]> {
    return Firmware.find({ where: { buildStatus: BuildStatus.DONE } });
  }

  public getFirmware(id: string): Promise<Firmware> {
    return Firmware.findOneOrFail({ where: { id } });
  }

  public getBuildStatusSubject(id: string) {
    return this.buildStatusSubject.asObservable().pipe(
      filter((status) => status.id === id),
      map((event) => ({ data: event })),
      debounceTime(500),
    );
  }

  public async onApplicationBootstrap() {
    await Firmware.createQueryBuilder()
      .update(Firmware)
      .set({
        buildStatus: BuildStatus.FAILED,
      })
      .where('buildStatus = :buildStatus', {
        buildStatus: BuildStatus.BUILDING,
      })
      .execute();

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

    const firmwares = await Firmware.find({
      where: {
        releaseID: Not(branchRelease.id),
      },
    });

    const oldFirmwares = firmwares.filter(
      ({ buildConfig: { version } }) => version === branchRelease.name,
    );

    oldFirmwares.forEach(async (firmware) => {
      await Firmware.delete({ id: firmware.id });
      await this.emptyS3Directory(
        this.appConfig.getBuildsBucket(),
        `${firmware.id}`,
      );
      console.log('deleted firmware id:', firmware.id);
    });
  }

  public getBoard(boardType: BoardType): string {
    return AVAILABLE_BOARDS[boardType].board;
  }

  private getPartitions(
    boardType: BoardType,
    rootFoler: string,
  ): { path: string; offset: number }[] {
    return AVAILABLE_BOARDS[boardType].partitions.map(
      ({ path, ...fields }) => ({
        ...fields,
        path: path.charAt(0) === '/' ? path : join(rootFoler, path),
      }),
    );
  }

  public async emptyS3Directory(bucket, dir) {
    const listObjectsV2 = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: dir,
    });

    const listedObjects = await this.s3.send(listObjectsV2);

    if (listedObjects.Contents.length === 0) return;

    const deleteParams = {
      Bucket: bucket,
      Delete: { Objects: [] },
    };

    listedObjects.Contents.forEach(({ Key }) => {
      deleteParams.Delete.Objects.push({ Key });
    });

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

  private async startBuildingTask(firmware: Firmware, release: ReleaseDTO) {
    let tmpDir;

    try {
      this.buildStatusSubject.next({
        buildStatus: BuildStatus.BUILDING,
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
        buildStatus: BuildStatus.BUILDING,
        id: firmware.id,
        message: 'Downloading SlimeVR firmware from Github',
      });

      await downloadFile(release.zipball_url, releaseFilePath);

      this.buildStatusSubject.next({
        buildStatus: BuildStatus.BUILDING,
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
        buildStatus: BuildStatus.BUILDING,
        id: firmware.id,
        message: 'Setting up defines and configs',
      });

      const [root] = await readdir(releaseFolderPath);
      const rootFoler = path.join(releaseFolderPath, root);

      const rotationToFirmware = function (rotation: number): number {
        // Reduce the angle to its lowest equivalent form,
        // negate it to match the firmware rotation direction,
        // then convert it to radians
        return (-(rotation % 360) / 180) * Math.PI;
      };

      const definesContent = `
        #define IMU ${firmware.buildConfig.imus[0].type}
        #define SECOND_IMU ${firmware.buildConfig.imus[1].type}
        #define BOARD ${firmware.buildConfig.board.type}
        #define IMU_ROTATION ${rotationToFirmware(
          firmware.buildConfig.imus[0].rotation,
        )}
        #define SECOND_IMU_ROTATION ${rotationToFirmware(
          firmware.buildConfig.imus[1].rotation,
        )}

        #define BATTERY_MONITOR ${firmware.buildConfig.battery.type}
        #define BATTERY_SHIELD_RESISTANCE ${
          firmware.buildConfig.battery.resistance
        }

        #define PIN_IMU_SDA ${firmware.buildConfig.board.pins.imuSDA}
        #define PIN_IMU_SCL ${firmware.buildConfig.board.pins.imuSCL}
        #define PIN_IMU_INT ${firmware.buildConfig.imus[0].imuINT}
        #define PIN_IMU_INT_2 ${firmware.buildConfig.imus[1].imuINT}
        #define PIN_BATTERY_LEVEL ${firmware.buildConfig.battery.pin}
        #define LED_BUILTIN ${firmware.buildConfig.board.pins.led}
        #define LED_PIN ${
          firmware.buildConfig.board.enableLed
            ? firmware.buildConfig.board.pins.led
            : 255
        }
      `;

      await Promise.all([
        writeFile(path.join(rootFoler, 'src', 'defines.h'), definesContent),
      ]);

      this.buildStatusSubject.next({
        buildStatus: BuildStatus.BUILDING,
        id: firmware.id,
        message: 'Building Firmware (this might take a minute)',
      });

      await new Promise((resolve, reject) => {
        const platformioRun = exec(
          `platformio run -e ${firmware.buildConfig.board.type} -c platformio-tools.ini`,
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

        platformioRun.stdout.on('data', (data) => {
          console.log('[BUILD LOG]', `[${firmware.id}]`, data.toString());
          this.buildStatusSubject.next({
            buildStatus: BuildStatus.BUILDING,
            id: firmware.id,
            message: 'Building Firmware (this might take a minute)',
          });
        });

        platformioRun.stderr.on('data', (data) => {
          console.log('[BUILD LOG]', `[${firmware.id}]`, data.toString());
        });

        platformioRun.on('exit', (code) => {
          if (code === 0) {
            resolve(true);
          } else reject({ message: 'bad exit code' });
        });
      });

      this.buildStatusSubject.next({
        buildStatus: BuildStatus.BUILDING,
        id: firmware.id,
        message: 'Uploading Firmware to Bucket',
      });

      const files = this.getPartitions(
        firmware.buildConfig.board.type,
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

      firmware.buildStatus = BuildStatus.DONE;
      firmware.firmwareFiles = files.map(({ offset }, index) => ({
        offset,
        url: `${this.appConfig.getBuildsBucket()}/${
          firmware.id
        }/firmware-part-${index}.bin`,
      }));
      await Firmware.save(firmware);

      this.buildStatusSubject.next({
        buildStatus: BuildStatus.DONE,
        id: firmware.id,
        message: 'Build complete',
        firmwareFiles: firmware.firmwareFiles,
      });
    } catch (e) {
      console.log(e);

      this.buildStatusSubject.next({
        buildStatus: BuildStatus.FAILED,
        id: firmware.id,
        message: `Build failed: ${e.message || e}`,
      });

      firmware.buildStatus = BuildStatus.FAILED;
      await Firmware.save(firmware);
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

  public async buildFirmware(dto: BuildFirmwareDTO): Promise<BuildResponse> {
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

      dto = BuildFirmwareDTO.completeDefaults(dto);

      let firmware = await Firmware.findOne({
        where: { buildConfig: dto, releaseID: release.id },
      });

      if (!firmware) firmware = Firmware.fromDTO(dto);

      if (firmware.id && firmware.buildStatus === BuildStatus.BUILDING) {
        return new BuildResponse(firmware.id, firmware.buildStatus);
      }

      if (firmware.id && firmware.buildStatus === BuildStatus.DONE) {
        return new BuildResponse(
          firmware.id,
          firmware.buildStatus,
          firmware.firmwareFiles,
        );
      }

      firmware.buildStatus = BuildStatus.BUILDING;
      firmware.releaseID = release.id;

      firmware = await Firmware.save(firmware);

      this.startBuildingTask(firmware, release as ReleaseDTO);

      return new BuildResponse(firmware.id, firmware.buildStatus);
    } catch (e) {
      throw VersionNotFoundExeption;
    }
  }
}
