import { ApiProperty } from '@nestjs/swagger';
import { CreateBoardConfigDTO } from './board-config.dto';
import { IMUDefaultPinsDTO } from './imu-config.dto';

export class DefaultBuildConfigDTO {
  /**
   * Default config of the selected board
   * contains all the default pins information about the selected board
   */
  @ApiProperty({
    type: CreateBoardConfigDTO,
    description:
      'Default config of the selected board.  Contains all the default pins information about the selected board',
  })
  public boardConfig: CreateBoardConfigDTO;

  /**
   * List of the possible imus pins, usually only two items will be sent
   */
  @ApiProperty({
    type: [IMUDefaultPinsDTO],
    minItems: 1,
    description:
      'List of the possible imus pins, usually only two items will be sent',
  })
  public imuPins: IMUDefaultPinsDTO[];
}
