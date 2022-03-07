import { ApiProperty } from '@nestjs/swagger';

export class FirmwareFile {
  @ApiProperty()
  public url: string;

  @ApiProperty()
  public offset: number;
}
