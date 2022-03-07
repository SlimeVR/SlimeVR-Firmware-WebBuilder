import { ApiProperty } from '@nestjs/swagger';
import { BuildStatus } from '../entity/firmware.entity';
import { FirmwareFile } from './firmware-files.dto';

export class BuildResponse {
  @ApiProperty()
  public id: string;

  @ApiProperty({ enum: BuildStatus })
  public status: BuildStatus;

  @ApiProperty({ required: false, type: [FirmwareFile] })
  public firmwareFiles?: FirmwareFile[];

  constructor(
    id: string,
    status: BuildStatus,
    firmwareFiles: FirmwareFile[] = undefined,
  ) {
    this.id = id;
    this.status = status;
    this.firmwareFiles = firmwareFiles;
  }
}
