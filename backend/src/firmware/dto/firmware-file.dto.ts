import { ApiProperty } from '@nestjs/swagger';
import { FirmwareFile } from '@prisma/client';

export class FirmwareFileDTO implements FirmwareFile {
  /**
   * Url to the file
   */
  @ApiProperty({ required: true, description: 'Url to the file' })
  url: string;

  /**
   * Address of the partition
   */
  @ApiProperty({ required: true, description: 'Address of the partition' })
  offset: number;

  /**
   * Id of the linked firmware
   */
  @ApiProperty({ required: true, description: 'Id of the linked firmware' })
  firmwareId: string;
}
