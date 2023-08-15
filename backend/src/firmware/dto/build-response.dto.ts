import { ApiProperty } from '@nestjs/swagger';
import { BuildStatus } from '@prisma/client';
import { FirmwareFileDTO } from './firmware-file.dto';

export class BuildResponseDTO {
  @ApiProperty()
  public id: string;

  @ApiProperty({ enum: BuildStatus })
  public status: BuildStatus;

  @ApiProperty({ required: false, type: [FirmwareFileDTO] })
  public firmwareFiles?: FirmwareFileDTO[];

  constructor(
    id: string,
    status: BuildStatus,
    firmwareFiles: FirmwareFileDTO[] | undefined = undefined,
  ) {
    this.id = id;
    this.status = status;
    this.firmwareFiles = firmwareFiles;
  }
}
