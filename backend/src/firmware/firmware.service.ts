import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ReleaseDTO } from 'src/github/dto/release.dto';
import { GithubService } from 'src/github/github.service';
import { APP_CONFIG, ConfigService } from 'src/config/config.service';
import {
  AVAILABLE_FIRMWARE_REPOS,
} from './firmware.constants';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { InjectAws } from 'aws-sdk-v3-nest';
import { PrismaService } from 'src/commons/prisma/prisma.service';
import {
  Firmware,
} from '@prisma/client';

@Injectable()
export class FirmwareService implements OnApplicationBootstrap {

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

  /**
   * Called when the api starts
   * this will check for all failled build and remove them
   */
  public async onApplicationBootstrap() {
    // We set all firmware builds that was in building state to failed
    // because the build did not complete and we have no way of resume the build
    await this.prisma.firmware.updateMany({
      where: { buildStatus: 'BUILDING' },
      data: { buildStatus: 'FAILED' },
    });
    this.cleanAllOldReleases();
    // Check every hour for failed builds and remove them 
    setInterval(() => {
      this.cleanAllOldReleases();
    }, 60 * 60 * 1000).unref();
  }

  /**
   * Clean all old releases of all the firmware repos
   */
  public async cleanAllOldReleases() {
    for (const [owner, repos] of Object.entries(AVAILABLE_FIRMWARE_REPOS)) {
      for (const [repo, branches] of Object.entries(repos)) {
        for (const branch of branches) {
          this.cleanOldReleases(owner, repo, branch);
        }
      }
    }
  }

  /**
   * Clean all the old releases of a specific repo
   */
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

  /**
   * Delete a folder and all its files inside a s3 bucket
   */
  private async emptyS3Directory(bucket, dir) {
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
}
