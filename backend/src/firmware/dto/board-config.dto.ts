import { OmitType } from '@nestjs/swagger';
import { BatteryType, BoardConfig, BoardType } from '@prisma/client';

export class BoardConfigDTO implements BoardConfig {
  /**
   * Unique id of the board config, used for relations
   *
   * @format uuid
   */
  id: string;

  /**
   * Type of the board
   * @see {BoardType}
   */
  type: BoardType;

  /**
   * Pin address of the indicator LED
   */
  ledPin: string;

  /**
   * Is the indicator LED enabled
   */
  enableLed: boolean;

  /**
   * Is the led inverted
   */
  ledInverted: boolean;

  /**
   * Pin address of the battery indicator
   */
  batteryPin: string;

  /**
   * Type of battery
   * @see {BatteryType}
   */
  batteryType: BatteryType;

  /**
   * Array of the different battery resistors, [indicator, SHIELD_R1, SHIELD_R2]
   *
   * @minItems 3
   * @maxItems 3
   */
  batteryResistances: number[];

  /**
   * Id of the linked firmware, used for relations
   *
   * @format uuid
   */
  firmwareId: string;
}

export class CreateBoardConfigDTO extends OmitType(BoardConfigDTO, [
  'id',
  'firmwareId',
]) {}
