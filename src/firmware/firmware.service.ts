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
  FirmwareSourceDeclaration,
  FirmwareSourceDetail,
  FirmwareSourcesDeclarations,
  FirmwareRollout,
  FirmwareUpdate,
  FirmwareUpdatePart,
  FirmwareWithFiles,
  GithubBranch,
  GithubRelease,
  GithubReleaseAsset,
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
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { PlatformIOService } from './platformio.service';
import { captureException, captureMessage } from '@sentry/nestjs';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'crypto';

const GITHUB_FETCH_TIMEOUT = 30_000;
const UPDATES_S3_PREFIX = 'updates';

const releaseVersion = (release: GithubRelease) =>
  semver.clean(release.tag_name);

const isBlocked = (definition: FirmwareSourceDeclaration, tag: string) =>
  !!definition.blockedVersions?.find((v) => semver.satisfies(tag, v));

/**
 * Assets matching the pattern, by the board captured in its `board` group
 */
const assetsByBoard = (assets: GithubReleaseAsset[], pattern: RegExp) => {
  const boards = new Map<string, GithubReleaseAsset>();
  for (const asset of assets) {
    const board = pattern.exec(asset.name)?.groups?.board;
    if (board && asset.browser_download_url) boards.set(board, asset);
  }
  return boards;
};

@Injectable()
export class FirmwareService implements OnApplicationBootstrap {
  private availableSources: FirmwareSourceDetail[] = [];
  private availableUpdates: FirmwareUpdate[] = [];
  // S3 key to digest of the release assets already mirrored
  private readonly mirroredAssets = new Map<string, string>();
  private readonly buildStatusSubject = new Subject<BuildStatus>();

  constructor(
    @Inject('DB') private db: NodePgDatabase<typeof schema>,
    @InjectAws(S3Client) private readonly s3: S3Client,
    @Inject(forwardRef(() => PlatformIOService))
    private platformioService: PlatformIOService,
  ) {}

  /**
   * @param forced also remove the unfinished builds, only safe when nothing is building (on startup)
   */
  async reloadSources(forced = false) {
    await this.loadSources();
    void this.cleanOldBuilds(forced);
  }

  async onApplicationBootstrap() {
    // Builds that were running when the app stopped will never finish
    await this.reloadSources(true);
  }

  @Cron('*/5 * * * *')
  async handleCron() {
    await this.reloadSources();
  }

  @Cron('0 1 * * *')
  async scheduleCleanup() {
    await this.cleanOldBuilds();
    await this.cleanOldUpdates();
  }

  async cleanOldBuilds(forced: boolean = false) {
    const release_ids = this.getSources().map(({ release_id }) => release_id);
    // Never cleanup without knowing the sources, this would wipe every build
    if (release_ids.length === 0) return;
    const oldFirmwares = await this.db.query.Firmwares.findMany({
      where: or(
        notInArray(schema.Firmwares.release_id, release_ids),
        forced
          ? ne(schema.Firmwares.status, 'DONE')
          : eq(schema.Firmwares.status, 'ERROR'),
      ),
    });

    for (const firmware of oldFirmwares) {
      await this.db
        .delete(schema.Firmwares)
        .where(eq(schema.Firmwares.id, firmware.id));
      await this.emptyS3Directory(S3_BUCKET, firmware.id).catch(() => null);
    }
  }

  /**
   * Remove the mirrored release assets no update points to anymore
   */
  async cleanOldUpdates() {
    // Never cleanup without knowing the updates, this would wipe every mirrored asset
    if (this.availableUpdates.length === 0) return;
    const usedKeys = new Set(
      this.availableUpdates.flatMap(({ latest }) =>
        latest.parts.map(({ url }) => url.substring(S3_BUCKET.length + 1)),
      ),
    );

    let continuationToken: string | undefined;
    do {
      const listed = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: S3_BUCKET,
          Prefix: `${UPDATES_S3_PREFIX}/`,
          ContinuationToken: continuationToken,
        }),
      );
      const oldKeys = (listed.Contents ?? [])
        .map(({ Key }) => Key)
        .filter((key): key is string => !!key && !usedKeys.has(key));
      if (oldKeys.length > 0) {
        await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: S3_BUCKET,
            Delete: { Objects: oldKeys.map((Key) => ({ Key })) },
          }),
        );
        for (const key of oldKeys) this.mirroredAssets.delete(key);
      }
      continuationToken = listed.IsTruncated
        ? listed.NextContinuationToken
        : undefined;
    } while (continuationToken);
  }

  /**
   * Fetch a json document from github
   * Returns null only when the resource does not exist (404), throws on any other failure
   * so a github outage is never mistaken for a removed release / file
   */
  private async fetchGithubJson(url: string): Promise<unknown> {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${GITHUB_AUTH_KEY}` },
      signal: AbortSignal.timeout(GITHUB_FETCH_TIMEOUT),
    });
    if (res.status === 404) return null;
    if (!res.ok)
      throw new Error(`github request failed (${res.status}) - ${url}`, {
        cause: await res.text().catch(() => null),
      });
    return (await res.json()) as unknown;
  }

  async fileFromBranch(source: string, branch: string, file: string) {
    return this.fetchGithubJson(
      `https://raw.githubusercontent.com/${source}/refs/heads/${branch}/${file}`,
    );
  }

  async fileFromTag(source: string, tag: string, file: string) {
    return this.fetchGithubJson(
      `https://raw.githubusercontent.com/${source}/refs/tags/${tag}/${file}`,
    );
  }

  async getReleases(source: string) {
    const releasesJson = await this.fetchGithubJson(
      `https://api.github.com/repos/${source}/releases`,
    );
    if (!releasesJson) return null;
    const releases = validatePrune<GithubRelease[]>(releasesJson);
    if (!releases.success)
      throw new Error(`Unable to parse releases of ${source}`, {
        cause: releases.errors,
      });
    return releases.data;
  }

  async getBranch(source: string, branch: string) {
    const branchJson = await this.fetchGithubJson(
      `https://api.github.com/repos/${source}/branches/${branch}`,
    );
    if (!branchJson) return null;
    const branchData = validatePrune<GithubBranch>(branchJson);
    if (!branchData.success)
      throw new Error(`Unable to parse branch ${source} / ${branch}`, {
        cause: branchData.errors,
      });
    return branchData.data;
  }

  async loadSources() {
    try {
      const newSources: FirmwareSourceDetail[] = [];
      const newUpdates: FirmwareUpdate[] = [];
      const sourcesJson = JSON.parse(
        await readFile(SOURCES_JSON_PATH, {
          encoding: 'utf-8',
        }),
      ) as unknown;
      const sources = validatePrune<FirmwareSourcesDeclarations>(sourcesJson);
      if (!sources.success) throw new Error('unable to load sources json file');

      for (const [source, definition] of Object.entries(sources.data)) {
        try {
          const loaded = await this.loadSource(source, definition);
          newSources.push(...loaded.sources);
          newUpdates.push(...loaded.updates);
        } catch (e) {
          // Github is unreachable or misbehaving, keep what we already know about this source
          // otherwise the cleanup would see its builds as outdated and delete them
          const cached = this.availableSources.filter(
            (s) => s.source === source,
          );
          newUpdates.push(
            ...this.availableUpdates.filter((u) => u.source === source),
          );
          captureMessage(
            `unable to load ${source} from github - keeping ${cached.length} cached entries`,
            'warning',
          );
          console.error(
            `unable to load ${source} from github - keeping ${cached.length} cached entries`,
            e,
          );
          newSources.push(...cached);
        }
      }

      this.availableUpdates = newUpdates;

      if (newSources.length === 0) {
        captureMessage('WARN - No sources found', 'warning');
        console.log('WARN - No sources found');
        return;
      }
      this.availableSources = newSources;
    } catch (e) {
      captureException(e);
    }
  }

  /**
   * Load the buildable releases, extra branches and updates of a source
   * Throws if github could not be reached so the caller can fallback on the cache
   */
  private async loadSource(
    source: string,
    definition: FirmwareSourceDeclaration,
  ): Promise<{ sources: FirmwareSourceDetail[]; updates: FirmwareUpdate[] }> {
    const releases = (await this.getReleases(source)) ?? [];
    const sources = definition.scanOnly
      ? []
      : await this.loadBuildSources(source, definition, releases);

    let updates: FirmwareUpdate[];
    try {
      updates = await this.loadUpdates(source, definition, releases);
    } catch (e) {
      // A failed mirror must not drop the buildable sources, keep the last known updates
      updates = this.availableUpdates.filter((u) => u.source === source);
      captureException(e);
      console.error(`unable to load updates of ${source}`, e);
    }
    return { sources, updates };
  }

  private async loadBuildSources(
    source: string,
    definition: FirmwareSourceDeclaration,
    releases: GithubRelease[],
  ): Promise<FirmwareSourceDetail[]> {
    const newSources: FirmwareSourceDetail[] = [];
    for (const release of releases) {
      if (!release.zipball_url) continue;
      if (isBlocked(definition, release.tag_name)) continue;
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
        captureMessage(`Unable to parse defaults from ${source}`, 'warning');
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

    for (const branch of definition.extraBranches ?? []) {
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
    return newSources;
  }

  /**
   * Latest release per board that ships a deploy.json, with its assets mirrored to s3
   */
  private async loadUpdates(
    source: string,
    definition: FirmwareSourceDeclaration,
    releases: GithubRelease[],
  ): Promise<FirmwareUpdate[]> {
    if (!definition.applicationAsset) return [];
    const applicationAsset = new RegExp(definition.applicationAsset);
    const bootloaderAsset = definition.bootloaderAsset
      ? new RegExp(definition.bootloaderAsset)
      : null;

    let minVersion: string | null = null;
    if (definition.minVersion) {
      minVersion = semver.valid(definition.minVersion);
      if (!minVersion)
        captureMessage(
          `Invalid minVersion ${definition.minVersion} for ${source}`,
          'warning',
        );
    }

    const candidates = releases
      .filter(
        (release) =>
          !release.draft &&
          (definition.allowPrerelease || !release.prerelease) &&
          !!releaseVersion(release) &&
          !isBlocked(definition, release.tag_name),
      )
      .sort((a, b) => semver.rcompare(releaseVersion(a)!, releaseVersion(b)!));

    const updates: FirmwareUpdate[] = [];
    const seenBoards = new Set<string>();
    for (const release of candidates) {
      const deployAsset = release.assets.find(
        ({ name }) => name === 'deploy.json',
      );
      if (!deployAsset) continue;

      const boards = [
        ...assetsByBoard(release.assets, applicationAsset),
      ].filter(([board]) => !seenBoards.has(board));
      if (boards.length === 0) continue;

      const rollout = await this.fetchRollout(deployAsset.browser_download_url);
      if (!rollout) continue;

      const bootloaders = bootloaderAsset
        ? assetsByBoard(release.assets, bootloaderAsset)
        : new Map<string, GithubReleaseAsset>();
      for (const [board, asset] of boards) {
        seenBoards.add(board);
        const parts: FirmwareUpdatePart[] = [];
        const bootloader = bootloaders.get(board);
        if (bootloader)
          parts.push({
            ...(await this.mirrorAsset(source, release.tag_name, bootloader)),
            offset: 0,
            kind: 'BOOTLOADER',
          });
        parts.push({
          ...(await this.mirrorAsset(source, release.tag_name, asset)),
          offset: 0,
          kind: 'APPLICATION',
        });
        updates.push({
          source,
          board,
          latest: { version: releaseVersion(release)!, parts },
          minVersion,
          rollout,
        });
      }
    }
    return updates;
  }

  /**
   * Read a release deploy.json, null when missing or invalid
   */
  private async fetchRollout(url: string): Promise<FirmwareRollout | null> {
    const deployJson = await this.fetchGithubJson(url);
    if (!deployJson) return null;
    const rollout = validatePrune<FirmwareRollout>(deployJson);
    if (!rollout.success) {
      captureMessage(`Unable to parse deploy.json ${url}`, 'warning');
      return null;
    }
    return rollout.data;
  }

  /**
   * Copy a release asset to s3 once, the digest is kept in the object metadata
   */
  private async mirrorAsset(
    source: string,
    tag: string,
    asset: GithubReleaseAsset,
  ): Promise<{ url: string; digest: string }> {
    const key = path.join(UPDATES_S3_PREFIX, source, tag, asset.name);
    const url = `${S3_BUCKET}/${key}`;

    const known = this.mirroredAssets.get(key);
    if (known) return { url, digest: known };

    const stored = await this.s3
      .send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }))
      .catch((e: { $metadata?: { httpStatusCode?: number } }) => {
        if (e.$metadata?.httpStatusCode === 404) return null;
        throw e;
      });
    const storedDigest = stored?.Metadata?.digest;
    if (storedDigest) {
      this.mirroredAssets.set(key, storedDigest);
      return { url, digest: storedDigest };
    }

    const res = await fetch(asset.browser_download_url, {
      headers: { Authorization: `Bearer ${GITHUB_AUTH_KEY}` },
      signal: AbortSignal.timeout(GITHUB_FETCH_TIMEOUT),
    });
    if (!res.ok)
      throw new Error(
        `github asset download failed (${res.status}) - ${asset.browser_download_url}`,
      );
    const buffer = Buffer.from(await res.arrayBuffer());
    const digest = `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
    if (asset.digest && asset.digest !== digest)
      throw new Error(`digest mismatch for ${asset.browser_download_url}`);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        Metadata: { digest },
      }),
    );
    this.mirroredAssets.set(key, digest);
    return { url, digest };
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

  getUpdates() {
    return this.availableUpdates;
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
