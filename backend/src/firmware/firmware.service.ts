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
import path from 'path';
import AdmZip from 'adm-zip';
import fetch from 'node-fetch';
import { BoardType } from './dto/firmware-board.dto';
import { exec } from 'child_process';
import { getConnection, Not } from 'typeorm';
import { InjectS3 } from 'nestjs-s3';
import { S3 } from 'aws-sdk';
import { APP_CONFIG, ConfigService } from 'src/config/config.service';
import { debounceTime, filter, map, Subject } from 'rxjs';
import { BuildStatusMessage } from './dto/build-status-message.dto';
import { AVAILABLE_FIRMWARE_REPOS } from './firmware.constants';

@Injectable()
export class FirmwareService implements OnApplicationBootstrap {
  private readonly buildStatusSubject = new Subject<BuildStatusMessage>();

  constructor(
    @InjectS3() private s3: S3,
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
    await getConnection()
      .createQueryBuilder()
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
    for (let [owner, repos] of Object.entries(AVAILABLE_FIRMWARE_REPOS)) {
      for (let [repo, branches] of Object.entries(repos)) {
        for (let branch of branches) {
          this.cleanOldReleases(owner, repo, branch);
        }
      }
    }
  }

  public async cleanOldReleases(
      owner: string = 'SlimeVR',
      repo: string = 'SlimeVR-Tracker-ESP',
      branch: string = 'main',
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
    const types = {
      [BoardType.BOARD_SLIMEVR]: 'esp12e',
      [BoardType.BOARD_SLIMEVR_DEV]: 'esp12e',
      [BoardType.BOARD_NODEMCU]: 'esp12e',
      [BoardType.BOARD_WEMOSD1MINI]: 'esp12e',
      [BoardType.BOARD_TTGO_TBASE]: 'esp12e',
      [BoardType.BOARD_WROOM32]: 'esp32dev',
      [BoardType.BOARD_ESP01]: 'esp32dev',
    };
    return types[boardType];
  }

  private getFiles(
    boardType: BoardType,
    rootFoler: string,
  ): { path: string; offset: number }[] {
    const types = {
      [BoardType.BOARD_SLIMEVR]: [
        {
          path: path.join(rootFoler, `.pio/build/BOARD_SLIMEVR/firmware.bin`),
          offset: 0,
        },
      ],
      [BoardType.BOARD_SLIMEVR_DEV]: [
        {
          path: path.join(
            rootFoler,
            `.pio/build/BOARD_SLIMEVR_DEV/firmware.bin`,
          ),
          offset: 0,
        },
      ],
      [BoardType.BOARD_NODEMCU]: [
        {
          path: path.join(rootFoler, `.pio/build/BOARD_NODEMCU/firmware.bin`),
          offset: 0,
        },
      ],
      [BoardType.BOARD_WEMOSD1MINI]: [
        {
          path: path.join(
            rootFoler,
            `.pio/build/BOARD_WEMOSD1MINI/firmware.bin`,
          ),
          offset: 0,
        },
      ],
      [BoardType.BOARD_TTGO_TBASE]: [
        {
          path: '/root/.platformio/packages/framework-arduinoespressif32/tools/sdk/esp32/bin/bootloader_dio_40m.bin',
          offset: 0x1000,
        },
        {
          path: path.join(
            rootFoler,
            `.pio/build/BOARD_TTGO_TBASE/partitions.bin`,
          ),
          offset: 0x8000,
        },
        {
          path: '/root/.platformio/packages/framework-arduinoespressif32/tools/partitions/boot_app0.bin',
          offset: 0xe000,
        },
        {
          path: path.join(
            rootFoler,
            `.pio/build/BOARD_TTGO_TBASE/firmware.bin`,
          ),
          offset: 0x10000,
        },
      ],
      [BoardType.BOARD_WROOM32]: [
        {
          path: '/root/.platformio/packages/framework-arduinoespressif32/tools/sdk/esp32/bin/bootloader_dio_40m.bin',
          offset: 0x1000,
        },
        {
          path: path.join(rootFoler, `.pio/build/BOARD_WROOM32/partitions.bin`),
          offset: 0x8000,
        },
        {
          path: '/root/.platformio/packages/framework-arduinoespressif32/tools/partitions/boot_app0.bin',
          offset: 0xe000,
        },
        {
          path: path.join(rootFoler, `.pio/build/BOARD_WROOM32/firmware.bin`),
          offset: 0x10000,
        },
      ],
      [BoardType.BOARD_ESP01]: [
        {
          path: '/root/.platformio/packages/framework-arduinoespressif32/tools/sdk/esp32/bin/bootloader_dio_40m.bin',
          offset: 0x1000,
        },
        {
          path: path.join(rootFoler, `.pio/build/BOARD_ESP01/partitions.bin`),
          offset: 0x8000,
        },
        {
          path: '/root/.platformio/packages/framework-arduinoespressif32/tools/partitions/boot_app0.bin',
          offset: 0xe000,
        },
        {
          path: path.join(rootFoler, `.pio/build/BOARD_ESP01/firmware.bin`),
          offset: 0x10000,
        },
      ],
    };

    return types[boardType];
  }

  public async emptyS3Directory(bucket, dir) {
    const listParams = {
      Bucket: bucket,
      Prefix: dir,
    };

    const listedObjects = await this.s3.listObjectsV2(listParams).promise();

    if (listedObjects.Contents.length === 0) return;

    const deleteParams = {
      Bucket: bucket,
      Delete: { Objects: [] },
    };

    listedObjects.Contents.forEach(({ Key }) => {
      deleteParams.Delete.Objects.push({ Key });
    });

    await this.s3.deleteObjects(deleteParams).promise();

    if (listedObjects.IsTruncated) await this.emptyS3Directory(bucket, dir);
  }

  uploadFirmware(id: string, name: string, buffer: Buffer) {
    return this.s3
      .upload({
        Bucket: this.appConfig.getBuildsBucket(),
        Key: path.join(id, name),
        Body: buffer,
      })
      .promise();
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

      const releaseFileName = `release-${release.name.replace(/[^A-Za-z0-9. ]/gi, '_')}.zip`;
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

      const definesContent = `
        #define IMU ${firmware.buildConfig.imus[0].type}
        #define SECOND_IMU ${firmware.buildConfig.imus[1].type}
        #define BOARD ${firmware.buildConfig.board.type}
        #define IMU_ROTATION ${firmware.buildConfig.imus[0].rotation} * PI / 180
        #define SECOND_IMU_ROTATION ${
          firmware.buildConfig.imus[1].rotation
        } * PI / 180

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

      const files = this.getFiles(firmware.buildConfig.board.type, rootFoler);

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
      const splitVersion = dto.version.split('/', 2);

      const owner = splitVersion.length > 1 ? splitVersion[0] : 'SlimeVR';
      let repo = 'SlimeVR-Tracker-ESP';
      const version = splitVersion.length > 1 ? splitVersion[1] : splitVersion[0];

      // TODO: Make the site say what repo to use, please
      // If there's a matching owner
      let ownerRepos = AVAILABLE_FIRMWARE_REPOS[owner];
      if (ownerRepos !== undefined) {
        for (let [repoToSearch, branches] of ownerRepos) {
          // And a matching branch
          if (branches.includes(version)) {
            // This is the target repo *probably*
            repo = repoToSearch;
            break;
          }
        }
      }

      const release = await this.githubService.getRelease(
        owner,
        repo,
        version,
      );

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
