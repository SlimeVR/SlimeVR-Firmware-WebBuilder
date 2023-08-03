import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum BoardType {
  BOARD_SLIMEVR = 'BOARD_SLIMEVR',
  BOARD_SLIMEVR_DEV = 'BOARD_SLIMEVR_DEV',
  BOARD_NODEMCU = 'BOARD_NODEMCU',
  BOARD_WROOM32 = 'BOARD_WROOM32',
  BOARD_WEMOSD1MINI = 'BOARD_WEMOSD1MINI',
  BOARD_TTGO_TBASE = 'BOARD_TTGO_TBASE',
  BOARD_ESP01 = 'BOARD_ESP01',
}

export class BoardPins {
  @ApiProperty()
  public imuSDA: string;

  @ApiProperty()
  public imuSCL: string;

  @ApiProperty({ required: false, default: '2' })
  public led?: string;
}

export class FirmwareBoardDTO {
  @ApiProperty({ enum: BoardType })
  @IsEnum(BoardType)
  public type: BoardType;

  @ApiProperty({ required: false })
  @IsOptional()
  public pins?: BoardPins;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  public enableLed?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  public ledInverted?: boolean;
}
