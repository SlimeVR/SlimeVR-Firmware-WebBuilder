import { ApiProperty } from '@nestjs/swagger';

export class ReleaseDTO {
  /**
   * id of the release, usually the commit id
   */
  @ApiProperty({
    required: true,
    description: 'id of the release, usually the commit id',
  })
  id: string;

  /**
   * url of the release
   */
  @ApiProperty({ required: true, description: 'url of the repository' })
  url: string;

  /**
   * name of the release
   */
  @ApiProperty({ required: true, description: 'name of the release' })
  name: string;

  /**
   * url of the source archive
   */
  @ApiProperty({ required: true, description: 'url of the source archive' })
  zipball_url: string;

  /**
   * Is this release a pre release
   */
  @ApiProperty({ required: true, description: 'Is this release a pre release' })
  prerelease: boolean;

  /**
   * Is this release a draft
   */
  @ApiProperty({ required: true, description: 'Is this release a draft' })
  draft: boolean;
}
