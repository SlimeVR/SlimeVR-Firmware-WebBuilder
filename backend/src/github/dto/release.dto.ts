export class ReleaseDTO {
  /**
   * id of the release, usually the commit id
   */
  id: string;

  /**
   * url of the release
   */
  url: string;

  /**
   * name of the release
   */
  name: string;

  /**
   * url of the source archive
   */
  zipball_url: string;

  /**
   * Is this release a pre release
   */
  prerelease: boolean;

  /**
   * Is this release a draft
   */
  draft: boolean;
}
