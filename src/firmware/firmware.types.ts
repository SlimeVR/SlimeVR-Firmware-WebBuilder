import * as schema from '../db.schema';

export type Toolchain = 'platformio';

export type BoardDefaults = {
  values: any;
  flashingRules: {
    applicationOffset: number;
    needBootPress: boolean;
    needManualReboot: boolean;
    shouldOnlyUseDefaults: boolean;
  };
};

export type DefaultsFile = {
  toolchain: Toolchain;
  defaults: { [board: string]: BoardDefaults };
};

export type FirmwareSource = {
  version: string;
  source: string;
  branch?: string;
  official: boolean;
  prerelease: boolean;
  availableBoards: string[];
};

export type FirmwareSourceDetail = FirmwareSource & {
  toolchain: Toolchain;
  data: DefaultsFile;
  schema: unknown;
  zipball_url: string;
  release_id: string;
};

export type FirmwareSourceDeclaration = {
  extraBranches?: string[];
  blockedVersions?: string[];
  official?: boolean;
  /**
   * Only scanned for updates, never built
   */
  scanOnly?: boolean;
  /**
   * Devices below this version must update
   */
  minVersion?: string;
  /**
   * Count prereleases as updates
   */
  allowPrerelease?: boolean;
  /**
   * Regex on release asset names with a `board` group, enables updates for this source
   */
  applicationAsset?: string;
  /**
   * Regex on release asset names with a `board` group, for the optional bootloader part
   */
  bootloaderAsset?: string;
};
export type FirmwareSourcesDeclarations = Record<
  string,
  FirmwareSourceDeclaration
>;

export type GithubReleaseAsset = {
  id: number;
  name: string;
  browser_download_url: string;
  digest?: string | null;
};

export type GithubRelease = {
  id: number;
  name: string;
  draft?: boolean;
  prerelease: boolean;
  tag_name: string;
  zipball_url?: string | null;
  assets: GithubReleaseAsset[];
};

export type BoardDefaultsQuery = {
  source: string;
  board: string;
  version: string;
};

export type FirmwareBoardDefaults = {
  schema: unknown;
  data: DefaultsFile;
};

export type BuildFirmwareBody = BoardDefaultsQuery & {
  values: BoardDefaults;
};

export type BuildFirmwareTask = BuildFirmwareBody & {
  id: string;
  sourceData: FirmwareSourceDetail;
};

export type FirmwareFile = typeof schema.FirmwareFiles.$inferSelect;
export type FirmwareWithFiles = typeof schema.Firmwares.$inferSelect & {
  files: FirmwareFile[];
};

type BuildStatusBasic = {
  id: string;
  status:
    | 'QUEUED'
    | 'CREATING_BUILD_FOLDER'
    | 'DOWNLOADING_SOURCE'
    | 'EXTRACTING_SOURCE'
    | 'BUILDING'
    | 'SAVING'
    | 'ERROR';
};
type BuildStatusDone = {
  id: string;
  status: 'DONE';
  files: FirmwareFile[];
};
export type BuildStatus = BuildStatusBasic | BuildStatusDone;

export type Partitions = {
  [key: string]: {
    extra: {
      flash_images: { offset: string; path: string }[];
      application_offset?: string;
    };
  };
};

type GithubBranchCommit = { sha: string };
export type GithubBranch = {
  commit: GithubBranchCommit;
};

/**
 * deploy.json content, rollout fraction (0 to 1) to the date it applies from
 */
export type FirmwareRollout = Record<string, string>;

export type FirmwareUpdatePart = {
  url: string;
  digest: string;
  offset: number;
  kind: 'APPLICATION' | 'BOOTLOADER';
};

export type FirmwareUpdate = {
  /**
   * repo path (ex: SlimeVR/SlimeVR-Tracker-ESP)
   */
  source: string;
  /**
   * Board name taken from the asset name
   */
  board: string;
  latest: {
    version: string;
    parts: FirmwareUpdatePart[];
  };
  minVersion: string | null;
  rollout: FirmwareRollout;
};
