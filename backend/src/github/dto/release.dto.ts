import { ApiProperty } from '@nestjs/swagger';

export class ReleaseDTO {
  @ApiProperty()
  id: string;
  @ApiProperty()
  url: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  zipball_url: string;
  @ApiProperty()
  prerelease: boolean;
  @ApiProperty()
  draft: boolean;
}
