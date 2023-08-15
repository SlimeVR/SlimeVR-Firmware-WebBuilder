import { ApiProperty } from '@nestjs/swagger';
import { CreateBoardConfigDTO } from './board-config.dto';
import { CreateImuConfigDTO } from './imu-config.dto';
import { IsArray, IsString } from 'class-validator';

export class CreateBuildConfigDTO {
  /**
   * Board config, used to declare the pins used by the board
   */
  @ApiProperty({ type: CreateBoardConfigDTO, description: 'Board config, used to declare the pins used by the board' })
  public boardConfig: CreateBoardConfigDTO;

  /**
   * Imu config, list of all the imus used and their pins
   */
  @ApiProperty({ type: [CreateImuConfigDTO], minItems: 1, description: 'Imu config, list of all the imus used and their pins' })
  @IsArray({ each: true })
  public imusConfig: CreateImuConfigDTO[];
}

export class CreateBuildFirmwareDTO extends CreateBuildConfigDTO {
  /**
   * Repository of the firmware used
   */
  @ApiProperty({ required: true, description: 'Repository of the firmware used' })
  @IsString()
  public version: string;
}
