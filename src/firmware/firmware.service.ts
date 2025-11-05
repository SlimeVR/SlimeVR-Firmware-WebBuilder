import {
  forwardRef,
  Inject,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import {
  BuildFirmwareBody,
  BuildStatus,
  DefaultsFile,
  FirmwareBoardDefaults,
  FirmwareSourceDetail,
  FirmwareSourcesDeclarations,
  FirmwareWithFiles,
  GithubBranch,
  GithubRelease,
} from './firmware.types';
import { readFile, writeFile } from 'fs/promises';
import { GITHUB_AUTH_KEY, S3_BUCKET, SOURCES_JSON_PATH } from 'src/env';
import semver from 'semver';
import { validatePrune } from 'typia/lib/misc';
import * as schema from '../db.schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import objectHash from 'object-hash';
import { debounceTime, filter, map, Subject } from 'rxjs';
import { eq, ne, notInArray, or } from 'drizzle-orm';
import path from 'path';
import { InjectAws } from 'aws-sdk-v3-nest';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { PlatformIOService } from './platformio.service';
import { captureException, captureMessage } from '@sentry/nestjs';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'crypto';

@Injectable()
export class FirmwareService implements OnApplicationBootstrap {
  private availableSources: FirmwareSourceDetail[];
  private readonly buildStatusSubject = new Subject<BuildStatus>();

  constructor(
    @Inject('DB') private db: NodePgDatabase<typeof schema>,
    @InjectAws(S3Client) private readonly s3: S3Client,
    @Inject(forwardRef(() => PlatformIOService))
    private platformioService: PlatformIOService,
  ) {}

  async reloadSources() {
    await this.loadSources();
    void this.cleanOldBuilds();
  }

  async onApplicationBootstrap() {
    await this.reloadSources();
  }

  @Cron('*/5 * * * *')
  async handleCron() {
    await this.reloadSources();
  }

  async cleanOldBuilds() {
    const release_ids = this.getSources().map(({ release_id }) => release_id);
    const oldFirmwares = await this.db.query.Firmwares.findMany({
      where: or(
        notInArray(schema.Firmwares.release_id, release_ids),
        ne(schema.Firmwares.status, 'DONE'),
      ),
    });

    for (const firmware of oldFirmwares) {
      await this.db
        .delete(schema.Firmwares)
        .where(eq(schema.Firmwares.id, firmware.id));
      await this.emptyS3Directory(S3_BUCKET, firmware.id).catch(() => null);
    }
  }

  async fileFromBranch(source: string, branch: string, file: string) {
    const defaultsFile = await fetch(
      `https://raw.githubusercontent.com/${source}/refs/heads/${branch}/${file}`,
      { headers: { Authorization: `Bearer ${GITHUB_AUTH_KEY}` } },
    )
      .then(async (res) => {
        if (res.ok) return (await res.json()) as unknown;
        throw new Error('error', { cause: await res.json() });
      })
      .catch(() => null);
    if (!defaultsFile) return null;
    return defaultsFile;
  }

  async fileFromTag(source: string, tag: string, file: string) {
    const defaultsFile = await fetch(
      `https://raw.githubusercontent.com/${source}/refs/tags/${tag}/${file}`,
      { headers: { Authorization: `Bearer ${GITHUB_AUTH_KEY}` } },
    )
      .then(async (res) => {
        if (res.ok) return (await res.json()) as unknown;
        throw new Error('error', { cause: await res.json() });
      })
      .catch(() => null);
    if (!defaultsFile) return null;
    return defaultsFile;
  }

  async getReleases(source: string) {
    const releasesJson = await fetch(
      `https://api.github.com/repos/${source}/releases`,
      { headers: { Authorization: `Bearer ${GITHUB_AUTH_KEY}` } },
    )
      .then(async (res) => {
        if (res.ok) return (await res.json()) as unknown;
        throw new Error('error', { cause: await res.json() });
      })
      .catch((err: Error) => {
        captureMessage('unable to load releases from ' + source, 'warning');
        console.error('unable to load releases from ' + source, err);
        return null;
      });
    if (!releasesJson) return null;
    const releases = validatePrune<GithubRelease[]>(releasesJson);
    if (!releases.success) {
      captureMessage(`Unable to parse release ${source} - skiping`, 'warning');
      console.error(
        `Unable to parse release ${source} - skiping`,
        releases.errors,
      );
      return null;
    }
    return releases.data;
  }

  async getBranch(source: string, branch: string) {
    const branchJson = await fetch(
      `https://api.github.com/repos/${source}/branches/${branch}`,
      { headers: { Authorization: `Bearer ${GITHUB_AUTH_KEY}` } },
    )
      .then(async (res) => {
        if (res.ok) return (await res.json()) as unknown;
        throw new Error('error', { cause: await res.json() });
      })
      .catch((err: Error) => {
        captureMessage(
          `unable to load branch from ${source} / ${branch}`,
          'warning',
        );
        console.error(`unable to load branch from ${source} / ${branch}`, err);
        return null;
      });
    if (!branchJson) return null;
    const branchData = validatePrune<GithubBranch>(branchJson);
    if (!branchData.success) {
      captureMessage(`Unable to parse release ${source} - skiping`, 'warning');
      console.error(
        `Unable to parse release ${source} - skiping`,
        branchData.errors,
      );
      return null;
    }
    return branchData.data;
  }

  async loadSources() {
    try {
      const newSources = [];
      const sourcesJson = JSON.parse(
        await readFile(SOURCES_JSON_PATH, {
          encoding: 'utf-8',
        }),
      ) as unknown;
      const sources = validatePrune<FirmwareSourcesDeclarations>(sourcesJson);
      if (!sources.success) throw new Error('unable to load sources json file');

      for (const [source, definition] of Object.entries(sources.data)) {
        const releases = await this.getReleases(source);
        if (!releases) continue;
        for (const release of releases) {
          if (!release.zipball_url) continue;
          if (
            definition.blockedVersions &&
            definition.blockedVersions.find((v) =>
              semver.satisfies(release.tag_name, v),
            )
          )
            continue;
          const [defaultsFile, schemaFile] = await Promise.all([
            this.fileFromTag(source, release.tag_name, 'board-defaults.json'),
            this.fileFromTag(
              source,
              release.tag_name,
              'board-defaults.schema.json',
            ),
          ]);
          if (!defaultsFile || !schemaFile) continue;
          const defaults = validatePrune<DefaultsFile>(defaultsFile);
          if (!defaults.success) {
            captureMessage(
              `Unable to parse defaults from ${source}`,
              'warning',
            );
            console.error(
              `Unable to parse defaults from ${source}`,
              defaults.errors,
            );
            continue;
          }
          newSources.push({
            toolchain: defaults.data.toolchain,
            availableBoards: Object.keys(defaults.data.defaults),
            data: defaults.data,
            schema: schemaFile,
            official: definition.official ?? false,
            prerelease: release.prerelease,
            source,
            version: release.tag_name,
            branch: 'main',
            zipball_url: release.zipball_url,
            release_id: release.id.toString(),
          });
        }

        if (definition.extraBranches) {
          for (const branch of definition.extraBranches) {
            const [ghBranch, defaultsFile, schemaFile] = await Promise.all([
              this.getBranch(source, branch),
              this.fileFromBranch(source, branch, 'board-defaults.json'),
              this.fileFromBranch(source, branch, 'board-defaults.schema.json'),
            ]);
            if (!defaultsFile || !schemaFile || !ghBranch) continue;
            const defaults = validatePrune<DefaultsFile>(defaultsFile);
            if (!defaults.success) {
              captureMessage(
                `Unable to parse defaults from ${source} / ${branch}`,
                'warning',
              );
              console.error(
                `Unable to parse defaults from ${source} / ${branch}`,
                defaults.errors,
              );
              continue;
            }
            newSources.push({
              toolchain: defaults.data.toolchain,
              availableBoards: Object.keys(defaults.data.defaults),
              data: defaults.data,
              schema: schemaFile,
              official: definition.official ?? false,
              prerelease: false,
              source,
              version: branch,
              branch,
              zipball_url: `https://github.com/${source}/archive/refs/heads/${branch}.zip`,
              release_id: ghBranch.commit.sha,
            });
          }
        }
      }

      if (newSources.length === 0) {
        captureMessage('WARN - No sources found', 'warning');
        console.log('WARN - No sources found');
      }
      this.availableSources = newSources;
    } catch (e) {
      captureException(e);
    }
  }

  async buildFirmware(body: BuildFirmwareBody): Promise<BuildStatus> {
    const source = this.availableSources.find(
      ({ source, version }) =>
        source === body.source && body.version === version,
    );
    if (!source) throw new Error('cant find the source');

    // Lets add the release id, to make sure the hash changes even when the artifacts from gh gets mutated
    const id = objectHash({ ...body, release_id: source.release_id });

    const foundFirmware = await this.db.query.Firmwares.findFirst({
      where: eq(schema.Firmwares.id, id),
      with: { files: true },
    });
    if (foundFirmware) {
      if (foundFirmware.status === 'DONE')
        return {
          id: foundFirmware.id,
          status: foundFirmware.status,
          files: foundFirmware.files,
        };
      else
        return {
          id: foundFirmware.id,
          status: foundFirmware.status,
        };
    }

    const res = await this.db
      .insert(schema.Firmwares)
      .values([{ status: 'QUEUED', id, release_id: source.release_id }])
      .returning({ id: schema.Firmwares.id });

    switch (source.toolchain) {
      case 'platformio':
        void this.platformioService.buildPlatformio({
          ...body,
          id: res[0].id,
          sourceData: source,
        });
        break;
      default:
        throw new Error('unsuppored platform');
    }
    return {
      id: res[0].id,
      status: 'QUEUED',
    };
  }

  downloadFile(url: string, path: string) {
    return fetch(url)
      .then((x) => x.arrayBuffer())
      .then((x) => writeFile(path, Buffer.from(x)));
  }

  /**
   * Upload a file to the related fw bucket
   */
  async uploadFile(
    id: string,
    name: string,
    buffer: Buffer,
    isFirmware = false,
    offset = 0,
  ) {
    // Calculate SHA-256 digest
    const hash = createHash('sha256');
    hash.update(buffer);
    const digest = `sha256:${hash.digest('hex')}`;

    const upload = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: path.join(id, name),
      Body: buffer,
    });
    const file = await this.s3.send(upload);
    const infos = await this.db
      .insert(schema.FirmwareFiles)
      .values([
        {
          firmwareId: id,
          filePath: `${S3_BUCKET}/${id}/${name}`,
          isFirmware,
          offset,
          digest,
        },
      ])
      .returning();
    return { s3: file, infos: infos[0] };
  }

  /**
   * Delete a folder and all its files inside a s3 bucket
   */
  private async emptyS3Directory(bucket: string, dir: string) {
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

  async updateBuildStatus(status: BuildStatus) {
    await this.db
      .update(schema.Firmwares)
      .set({ status: status.status })
      .where(eq(schema.Firmwares.id, status.id));
    this.buildStatusSubject.next(status);
  }

  getSources() {
    return this.availableSources;
  }

  getBoard(s: string, v: string, board: string): FirmwareBoardDefaults | null {
    const fwSource = this.availableSources.find(
      ({ source, version }) => source === s && v === version,
    );

    if (!fwSource || !fwSource.data.defaults[board]) return null;

    return {
      schema: fwSource.schema,
      data: {
        ...fwSource.data,
        defaults: Object.entries(fwSource.data.defaults).reduce(
          (curr, [key, val]) => (key !== board ? curr : { [key]: val }),
          {} as DefaultsFile['defaults'],
        ),
      },
    };
  }

  async getFirmware(id: string): Promise<FirmwareWithFiles | null> {
    const firmware = await this.db.query.Firmwares.findFirst({
      where: eq(schema.Firmwares.id, id),
      with: { files: true },
    });
    if (!firmware) return null;
    return firmware;
  }

  /**
   * Subject with the build status, this gives the current status of a build from its id
   */
  public getBuildStatusSubject(id: string) {
    return this.buildStatusSubject.asObservable().pipe(
      filter((status) => status.id === id),
      map((event) => ({ data: event })),
      debounceTime(100),
    );
  }
}
