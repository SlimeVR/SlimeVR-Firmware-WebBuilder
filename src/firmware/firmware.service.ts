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
import { getConnection } from 'typeorm';
import { InjectS3 } from 'nestjs-s3';
import { S3 } from 'aws-sdk';
import { APP_CONFIG, ConfigService } from 'src/config/config.service';

@Injectable()
export class FirmwareService implements OnApplicationBootstrap {
  constructor(
    @InjectS3() private s3: S3,
    private githubService: GithubService,
    @Inject(APP_CONFIG) private appConfig: ConfigService,
  ) {}

  public getFirmwares(): Promise<Firmware[]> {
    return Firmware.find({ where: { buildStatus: BuildStatus.DONE } });
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
  }

  private getBoard(boardType: BoardType): string {
    const types = {
      [BoardType.BOARD_SLIMEVR]: 'esp12e',
      [BoardType.BOARD_SLIMEVR_DEV]: 'esp12e',
      [BoardType.BOARD_NODEMCU]: 'esp12e',
      [BoardType.BOARD_WEMOSD1MINI]: 'esp12e',
      [BoardType.BOARD_TTGO_TBASE]: 'esp32dev',
      [BoardType.BOARD_WROOM32]: 'esp32dev',
    };
    return types[boardType];
  }

  private getPlatform(boardType: BoardType): string {
    const types = {
      [BoardType.BOARD_SLIMEVR]: 'espressif8266',
      [BoardType.BOARD_SLIMEVR_DEV]: 'espressif8266',
      [BoardType.BOARD_NODEMCU]: 'espressif8266',
      [BoardType.BOARD_WEMOSD1MINI]: 'espressif8266',
      [BoardType.BOARD_TTGO_TBASE]: 'espressif32',
      [BoardType.BOARD_WROOM32]: 'espressif32',
    };

    return types[boardType];
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

  private async startBuildingTask(firmware: Firmware, release: ReleaseDTO) {
    let tmpDir;

    try {
      tmpDir = await mkdtemp(path.join(os.tmpdir(), 'slimevr-api'));

      const releaseFileName = `release-${release.name}.zip`;
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

      await downloadFile(
        'https://github.com/SlimeVR/SlimeVR-Tracker-ESP/archive/refs/heads/main.zip',
        releaseFilePath,
      );
      console.log('download done');
      const releaseFolderPath = path.join(tmpDir, `release-${release.name}`);
      const zip = new AdmZip(releaseFilePath);
      // Extract release
      console.log('start extract', releaseFilePath, releaseFolderPath);
      await new Promise((resolve) => {
        zip.extractAllTo(releaseFolderPath, true);
        resolve(true);
      });
      console.log('unzip done');
      const [root] = await readdir(releaseFolderPath);
      const rootFoler = path.join(releaseFolderPath, root);

      const platformioContent = `
        [env]
        lib_deps=
          https://github.com/SlimeVR/CmdParser.git
        monitor_speed = 115200
        framework = arduino
        build_flags =
          -DLED_BUILTIN=${firmware.buildConfig.board.pins.led}
          -O2
        build_unflags = -Os

        [env:default]
        platform = ${this.getPlatform(firmware.buildConfig.board.type)}
        board = ${this.getBoard(firmware.buildConfig.board.type)}
      `;

      const definesContent = `
        #define IMU ${firmware.buildConfig.imus[0].type}
        #define SECOND_IMU ${firmware.buildConfig.imus[1].type}
        #define BOARD ${firmware.buildConfig.board.type}
        #define IMU_ROTATION ${firmware.buildConfig.imus[0].rotation} * PI / 180
        #define SECOND_IMU_ROTATION ${firmware.buildConfig.imus[1].rotation} * PI / 180

        #define BATTERY_MONITOR ${firmware.buildConfig.battery.type}
        #define BATTERY_SHIELD_RESISTANCE ${firmware.buildConfig.battery.resistance}
        
        #define PIN_IMU_SDA ${firmware.buildConfig.board.pins.imuSDA}
        #define PIN_IMU_SCL ${firmware.buildConfig.board.pins.imuSCL}
        #define PIN_IMU_INT ${firmware.buildConfig.imus[0].imuINT}
        #define PIN_IMU_INT_2 ${firmware.buildConfig.imus[1].imuINT}
        #define PIN_BATTERY_LEVEL ${firmware.buildConfig.battery.pin}
        #define ENABLE_LEDS ${firmware.buildConfig.board.enableLed}
      `;

      await Promise.all([
        writeFile(path.join(rootFoler, 'src', 'defines.h'), definesContent),
        writeFile(path.join(rootFoler, 'platformio.ini'), platformioContent),
      ]);

      await new Promise((resolve, reject) => {
        const platformioRun = exec('platformio run', { cwd: rootFoler });

        platformioRun.stdout.on('data', (data) => {
          console.log(data.toString());
        });

        platformioRun.stderr.on('data', (data) => {
          console.log('error', data.toString());
        });

        platformioRun.on('exit', (code) => {
          console.log('exit with code', code);

          if (code === 0) {
            resolve(true);
          } else reject({ error: 'bad exit code' });
        });
      });

      await Promise.all([
        this.uploadFirmware(
          firmware.id,
          'firmware.bin',
          await readFile(
            path.join(rootFoler, `.pio/build/default/firmware.bin`),
          ),
        ),
        this.uploadFirmware(
          firmware.id,
          'firmware.elf',
          await readFile(
            path.join(rootFoler, `.pio/build/default/firmware.elf`),
          ),
        ),
      ]);

      console.log('done ?', rootFoler);
    } catch (e) {
      console.log(e);
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

      firmware.buildStatus = BuildStatus.DONE;
      await Firmware.save(firmware);
    }
  }

  public async buildFirmware(dto: BuildFirmwareDTO): Promise<BuildResponse> {
    try {
      const release = await this.githubService.getRelease(
        'SlimeVR',
        'SlimeVR-Tracker-ESP',
        dto.version,
      );

      dto = BuildFirmwareDTO.completeDefaults(dto);

      let firmware = await Firmware.findOne({
        where: { buildConfig: dto },
      });
      console.log(firmware);

      if (!firmware) firmware = Firmware.fromDTO(dto);

      if (firmware.id && firmware.buildStatus === BuildStatus.BUILDING) {
        return new BuildResponse(firmware.id, firmware.buildStatus);
      }

      firmware.buildStatus = BuildStatus.BUILDING;

      firmware = await Firmware.save(firmware);

      console.log('BUILD!!!!');

      this.startBuildingTask(firmware, release as ReleaseDTO);

      return new BuildResponse(firmware.id, firmware.buildStatus);
    } catch (e) {
      throw VersionNotFoundExeption;
    }
  }
}
