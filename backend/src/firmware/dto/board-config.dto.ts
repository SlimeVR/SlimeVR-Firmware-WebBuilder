import { ApiProperty } from '@nestjs/swagger';
import { BatteryType, BoardConfig, BoardType } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsString } from 'class-validator';

export class BoardConfigDTO implements BoardConfig {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: BoardType;

  @ApiProperty()
  ledPin: string;

  @ApiProperty()
  enableLed: boolean;

  @ApiProperty()
  ledInverted: boolean;

  @ApiProperty()
  batteryPin: string;

  @ApiProperty()
  batteryType: BatteryType;

  @ApiProperty()
  batteryResistances: number[];

  @ApiProperty()
  firmwareId: string;
}

export class CreateBoardConfigDTO
  implements Omit<BoardConfigDTO, 'id' | 'firmwareId'>
{
  @ApiProperty({ enum: BoardType })
  @IsEnum(BoardType)
  type: BoardType;

  @ApiProperty()
  @IsString()
  ledPin: string;

  @ApiProperty()
  @IsBoolean()
  enableLed: boolean;

  @ApiProperty()
  @IsBoolean()
  ledInverted: boolean;

  @ApiProperty()
  @IsString()
  batteryPin: string;

  @ApiProperty()
  @IsEnum(BatteryType)
  batteryType: BatteryType;

  @ApiProperty()
  @IsArray({ each: true })
  batteryResistances: number[];
}
