import { ApiProperty } from '@nestjs/swagger';

export class GithubRepositoryDTO {
  /**
   * id of the github repository
   */
  @ApiProperty({ required: true, description: 'id of the github repository' })
  id: number;

  /**
   * Url to the releases
   */
  @ApiProperty({ required: true, description: 'Url to the releases' })
  releases_url: string;
}
