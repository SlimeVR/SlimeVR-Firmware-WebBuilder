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
};
export type FirmwareSourcesDeclarations = Record<
  string,
  FirmwareSourceDeclaration
>;

export type GithubRelease = {
  id: number;
  name: string;
  prerelease: boolean;
  tag_name: string;
  zipball_url?: string | null;
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
