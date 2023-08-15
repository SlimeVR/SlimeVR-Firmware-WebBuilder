import { ApiProperty } from '@nestjs/swagger';
import { FirmwareFile } from '@prisma/client';

export class FirmwareFileDTO implements FirmwareFile {
  @ApiProperty()
  url: string;

  @ApiProperty()
  offset: number;

  @ApiProperty()
  firmwareId: string;
}
