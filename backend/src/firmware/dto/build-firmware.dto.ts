import { CreateBoardConfigDTO } from './board-config.dto';
import { CreateImuConfigDTO } from './imu-config.dto';

export class CreateBuildConfigDTO {
  /**
   * Board config, used to declare the pins used by the board
   */
  public boardConfig: CreateBoardConfigDTO;

  /**
   * Imu config, list of all the imus used and their pins
   *
   * @minItems 1
   */
  public imusConfig: CreateImuConfigDTO[];
}

export class CreateBuildFirmwareDTO extends CreateBuildConfigDTO {
  /**
   * Repository of the firmware used
   */
  public version: string;
}
