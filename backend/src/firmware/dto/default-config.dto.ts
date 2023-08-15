import { ApiProperty } from '@nestjs/swagger';
import { CreateBoardConfigDTO } from './board-config.dto';
import { IMUDefaultPinsDTO } from './imu-pins.dto';

export class DefaultBuildConfigDTO {
  @ApiProperty({ type: CreateBoardConfigDTO })
  public boardConfig: CreateBoardConfigDTO;

  @ApiProperty({ type: [IMUDefaultPinsDTO] })
  public imuPins: IMUDefaultPinsDTO[];
}
