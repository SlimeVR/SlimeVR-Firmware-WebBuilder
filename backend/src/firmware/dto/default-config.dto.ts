import { CreateBoardConfigDTO } from './board-config.dto';
import { IMUDefaultPinsDTO } from './imu-config.dto';

export class DefaultBuildConfigDTO {
  /**
   * Default config of the selected board
   * contains all the default pins information about the selected board
   */
  public boardConfig: CreateBoardConfigDTO;

  /**
   * List of the possible imus pins, usually only two items will be sent
   *
   * @minItems 1
   */
  public imuPins: IMUDefaultPinsDTO[];
}
