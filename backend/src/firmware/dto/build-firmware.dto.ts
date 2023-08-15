import { ApiProperty } from '@nestjs/swagger';
import { CreateBoardConfigDTO } from './board-config.dto';
import { CreateImuConfigDTO } from './imu-config.dto';

export class CreateBuildConfigDTO {
  @ApiProperty({ type: CreateBoardConfigDTO })
  public boardConfig: CreateBoardConfigDTO;

  @ApiProperty({ type: [CreateImuConfigDTO] })
  public imusConfig: CreateImuConfigDTO[];
}

export class CreateBuildFirmwareDTO extends CreateBuildConfigDTO {
  @ApiProperty()
  public version: string;
}
