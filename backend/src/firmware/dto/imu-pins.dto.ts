import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class IMUDefaultPinsDTO {
  @ApiProperty()
  @IsString()
  intPin: string;

  @ApiProperty()
  @IsString()
  sclPin: string;

  @ApiProperty()
  @IsString()
  sdaPin: string;
}
