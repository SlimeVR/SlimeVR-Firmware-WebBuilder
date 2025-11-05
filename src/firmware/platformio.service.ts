import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  BuildFirmwareTask,
  FirmwareSourceDetail,
  Partitions,
} from './firmware.types';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import { assertPrune } from 'typia/lib/misc';
import path, { join } from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import { exec, execSync } from 'child_process';
import { InjectAws } from 'aws-sdk-v3-nest';
import { S3Client } from '@aws-sdk/client-s3';
import { FirmwareService } from './firmware.service';
import { captureException, getCurrentScope } from '@sentry/nestjs';
import { APP_ENV } from 'src/env';

@Injectable()
export class PlatformIOService {
  constructor(
    @InjectAws(S3Client) private readonly s3: S3Client,
    @Inject(forwardRef(() => FirmwareService))
    private firmwareService: FirmwareService,
  ) {}

  downloadFile(url: string, path: string) {
    return fetch(url)
      .then((x) => x.arrayBuffer())
      .then((x) => writeFile(path, Buffer.from(x)));
  }

  async buildPlatformio(build: BuildFirmwareTask) {
    const logs: string[] = [];
    let tmpDir;
    try {
      await this.firmwareService.updateBuildStatus({
        id: build.id,
        status: 'CREATING_BUILD_FOLDER',
      });
      tmpDir = await mkdtemp(path.join(os.tmpdir(), 'slimevr-api'));
      const releaseFileName = `release-${build.version.replace(
        /[^A-Za-z0-9. ]/gi,
        '_',
      )}.zip`;
      const releaseFilePath = path.join(tmpDir, releaseFileName);

      await this.firmwareService.updateBuildStatus({
        id: build.id,
        status: 'DOWNLOADING_SOURCE',
      });
      await this.downloadFile(build.sourceData.zipball_url, releaseFilePath);

      await this.firmwareService.updateBuildStatus({
        id: build.id,
        status: 'EXTRACTING_SOURCE',
      });
      const releaseFolderPath = path.join(tmpDir, `release-${build.version}`);
      const zip = new AdmZip(releaseFilePath);
      await new Promise((resolve) => {
        zip.extractAllTo(releaseFolderPath, true);
        resolve(true);
      });

      const [root] = await readdir(releaseFolderPath);
      const rootFoler = path.join(releaseFolderPath, root);

      await this.firmwareService.updateBuildStatus({
        id: build.id,
        status: 'BUILDING',
      });

      const fwVersion = build.sourceData.official
        ? build.sourceData.version.startsWith('v')
          ? build.sourceData.version.substring(1)
          : build.sourceData.version
        : undefined;

      await new Promise((resolve, reject) => {
        const platformioRun = exec(`platformio run -e ${build.board}`, {
          cwd: rootFoler,
          env: {
            // Keep existing variables
            ...process.env,
            FIRMWARE_VERSION: fwVersion,
            SLIMEVR_OVERRIDE_DEFAULTS: `${JSON.stringify(build.values.values)}`,
            // Git commit hash or release tag
            GIT_REV: build.version,
          },
        });

        platformioRun.stdout?.on('data', (data: Buffer) => {
          logs.push(data.toString());
          if (APP_ENV === 'development') {
            console.log('[BUILD LOG]', `[${build.id}]`, data.toString());
          }
        });

        platformioRun.stderr?.on('data', (data: Buffer) => {
          logs.push(`[ERR] ${data.toString()}`);
          if (APP_ENV === 'development') {
            console.log('[BUILD LOG][ERR]', `[${build.id}]`, data.toString());
          }
        });

        platformioRun.on('exit', (code) => {
          if (code === 0) {
            resolve(true);
          } else reject(new Error('bad exit code'));
        });
      });

      await this.firmwareService.updateBuildStatus({
        id: build.id,
        status: 'SAVING',
      });

      const files = await this.getPartitions(
        build.board,
        build.sourceData,
        rootFoler,
      );

      const uploadedFiles = await Promise.all(
        files.map(async ({ path, isFirmware, offset }, index) =>
          this.firmwareService.uploadFile(
            build.id,
            `firmware-part-${index}.bin`,
            await readFile(path),
            isFirmware,
            offset,
          ),
        ),
      );

      await this.firmwareService.updateBuildStatus({
        id: build.id,
        status: 'DONE',
        files: uploadedFiles.map(({ infos }) => infos),
      });
    } catch (e) {
      await this.firmwareService.updateBuildStatus({
        id: build.id,
        status: 'ERROR',
      });

      getCurrentScope().addAttachment({
        filename: 'pio-logs.txt',
        data: logs.join(''),
      });
      captureException(e);
      console.error(e);
    } finally {
      if (tmpDir) {
        await rm(tmpDir, { recursive: true });
      }
    }
  }

  /**
   * Get the board partitions infos
   */
  private async getPartitions(
    board: string,
    source: FirmwareSourceDetail,
    rootFoler: string,
  ): Promise<{ path: string; offset: number; isFirmware: boolean }[]> {
    const ideInfos = await new Promise<Partitions>((resolve) => {
      const metadata = execSync(
        `platformio project metadata --json-output -e ${board}`,
        {
          cwd: rootFoler,
          shell: '/bin/bash',
        },
      );
      resolve(assertPrune<Partitions>(JSON.parse(metadata.toString())));
    });
    return [
      ...ideInfos[board].extra.flash_images.map(({ offset, ...fields }) => ({
        offset: parseInt(offset),
        isFirmware: false,
        ...fields,
      })),
      {
        path: join(rootFoler, `.pio/build/${board}/firmware.bin`),
        offset: source.data.defaults[board].flashingRules.applicationOffset,
        isFirmware: true,
      },
    ];
  }
}
