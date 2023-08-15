import { ApiProperty } from '@nestjs/swagger';
import { BuildStatus } from '@prisma/client';
import { FirmwareFileDTO } from './firmware-file.dto';
import { IsEnum, IsString, IsUUID } from 'class-validator';

export class BuildResponseDTO {
  /**
   * Id of the firmware
   * @see {Firmware}
   */
  @ApiProperty({ required: true, description: 'id of the firmware' })
  @IsUUID()
  public id: string;

  /**
   * Build status of the firmware
   * @see {BuildStatus}
   */
  @ApiProperty({
    enum: BuildStatus,
    required: true,
    description: 'Build status of the firmware',
  })
  @IsEnum(BuildStatus)
  public status: BuildStatus;

  /**
   * List of built firmware files, only set if the build succeeded
   */
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

export class BuildStatusMessage extends BuildResponseDTO {
  @ApiProperty({ required: true })
  @IsString()
  message: string;
}
