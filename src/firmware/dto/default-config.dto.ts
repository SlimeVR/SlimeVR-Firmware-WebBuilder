import { CreateBoardConfigDTO } from './board-config.dto';
import { IMUDefaultDTO } from './imu-config.dto';

export interface DefaultBuildConfigDTO {
  /**
   * Default config of the selected board
   * contains all the default pins information about the selected board
   */
  boardConfig: CreateBoardConfigDTO;

  /**
   * Inform the flashing utility that the user need to press the boot (or Flash) button
   * on the tracker
   */
  needBootPress?: boolean;

  /**
   * Inform the flashing utility that the board will need a reboot after
   * being flashed
   */
  needManualReboot?: boolean;

  /**
   * Will use the default values and skip the customisation options
   */
  shouldOnlyUseDefaults?: boolean;

  /**
   * List of the possible imus pins, usually only two items will be sent
   *
   * @minItems 1
   */
  imuDefaults: IMUDefaultDTO[];

  /**
   * Gives the offset of the firmare file in the eeprom. Used for flashing
   */
  application_offset: number;
}
