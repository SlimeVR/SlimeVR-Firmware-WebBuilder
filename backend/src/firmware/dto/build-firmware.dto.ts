import { CreateBoardConfigDTO } from './board-config.dto';
import { CreateImuConfigDTO } from './imu-config.dto';

export interface CreateBuildConfigDTO {
  /**
   * Board config, used to declare the pins used by the board
   */
  boardConfig: CreateBoardConfigDTO;

  /**
   * Imu config, list of all the imus used and their pins
   *
   * @minItems 1
   */
  imusConfig: CreateImuConfigDTO[];
}

export interface CreateBuildFirmwareDTO extends CreateBuildConfigDTO {
  /**
   * Repository of the firmware used
   */
  version: string;
}
