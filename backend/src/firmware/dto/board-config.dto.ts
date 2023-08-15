import { ApiProperty, OmitType } from '@nestjs/swagger';
import { BatteryType, BoardConfig, BoardType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsString,
  IsUUID,
} from 'class-validator';

export class BoardConfigDTO implements BoardConfig {
  /**
   * Unique id of the board config, used for relations
   */
  @ApiProperty({
    required: true,
    description: 'Unique id of the board config, used for relations',
  })
  @IsUUID()
  id: string;

  /**
   * Type of the board
   * @see {BoardType}
   */
  @ApiProperty({
    enum: BoardType,
    required: true,
    description: 'Type of the board',
  })
  @IsEnum(BoardType)
  type: BoardType;

  /**
   * Pin address of the indicator LED
   */
  @ApiProperty({
    required: true,
    description: 'Pin address of the indicator LED',
  })
  @IsString()
  ledPin: string;

  /**
   * Is the indicator LED enabled
   */
  @ApiProperty({ required: true, description: 'Is the LED enabled' })
  @IsBoolean()
  enableLed: boolean;

  /**
   * Is the led inverted
   */
  @ApiProperty({ required: true, description: 'Is the led inverted' })
  @IsBoolean()
  ledInverted: boolean;

  /**
   * Pin address of the battery indicator
   */
  @ApiProperty({
    required: true,
    description: 'Pin address of the battery indicator',
  })
  @IsString()
  batteryPin: string;

  /**
   * Type of battery
   * @see {BatteryType}
   */
  @ApiProperty({
    enum: BatteryType,
    required: true,
    description: 'Type of battery',
  })
  @IsEnum(BatteryType)
  batteryType: BatteryType;

  /**
   * Array of the different battery resistors, [indicator, SHIELD_R1, SHIELD_R2]
   */
  @ApiProperty({
    required: true,
    minItems: 3,
    maxItems: 3,
    description:
      'Array of the different battery resistors, [indicator, SHIELD_R1, SHIELD_R2]',
  })
  @IsArray({ each: true })
  @IsNumber()
  batteryResistances: number[];

  /**
   * Id of the linked firmware, used for relations
   */
  @ApiProperty({
    required: true,
    description: 'Id of the linked firmware, used for relations',
  })
  @IsString()
  firmwareId: string;
}

export class CreateBoardConfigDTO extends OmitType(BoardConfigDTO, [
  'id',
  'firmwareId',
]) {}
