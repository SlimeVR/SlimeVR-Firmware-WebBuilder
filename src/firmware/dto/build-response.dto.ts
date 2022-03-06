import { ApiProperty } from '@nestjs/swagger';
import { BuildStatus } from '../entity/firmware.entity';

export class BuildResponse {
  @ApiProperty()
  public id: string;

  @ApiProperty()
  public status: BuildStatus;

  constructor(id: string, status: BuildStatus) {
    this.id = id;
    this.status = status;
  }
}
