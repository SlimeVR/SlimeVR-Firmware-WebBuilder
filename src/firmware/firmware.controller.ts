import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Sse,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReleaseDTO } from 'src/github/dto/release.dto';
import { GithubService } from 'src/github/github.service';
import { BatteryType } from './dto/battery.dto';
import { BoardTypeBoard } from './dto/board-type-board.dto';
import { BuildFirmwareDTO } from './dto/build-firmware.dto';
import { BuildResponse } from './dto/build-response.dto';
import { BoardType, FirmwareBoardDTO } from './dto/firmware-board.dto';
import { IMUConfigDTO, IMUDTO, IMUS, IMUType } from './dto/imu.dto';
import { Firmware } from './entity/firmware.entity';
import { VersionNotFoundError } from './errors/version-not-found.error';
import { FirmwareService } from './firmware.service';

@ApiTags('slimevr')
@Controller('firmwares')
export class FirmwareController {
  constructor(
    private firmwareService: FirmwareService,
    private githubService: GithubService,
  ) {}

  @Get('/')
  @ApiResponse({ type: [Firmware] })
  getFirmwares() {
    return this.firmwareService.getFirmwares();
  }

  @Post('/build')
  @ApiOperation({
    description: 'Build a specific configuration of the firmware',
  })
  @ApiOkResponse({ type: BuildResponse })
  @ApiBadRequestResponse({ description: VersionNotFoundError })
  async buildAll(@Body() body: BuildFirmwareDTO) {
    return this.firmwareService.buildFirmware(body);
  }

  @Sse('/build-status/:id')
  buildStatus(@Param('id') id: string) {
    return this.firmwareService.getBuildStatusSubject(id);
  }

  @Get('/boards')
  @ApiOkResponse({ type: [BoardTypeBoard] })
  getBoardsTypes(): BoardTypeBoard[] {
    return Object.keys(BoardType).map((board) => ({
      boardType: BoardType[board],
      board: this.firmwareService.getBoard(BoardType[board]),
    }));
  }

  @Get('/versions')
  @ApiOkResponse({ type: [ReleaseDTO] })
  async getVersions(): Promise<ReleaseDTO[]> {
    return this.githubService.getReleases('SlimeVR', 'SlimeVR-Tracker-ESP');
  }

  @Get('/imus')
  @ApiOkResponse({ type: [IMUDTO] })
  getIMUSTypes(): IMUDTO[] {
    return IMUS;
  }

  @Get('/batteries')
  @ApiOkResponse({ type: [String] })
  getBatteriesTypes(): string[] {
    return Object.keys(BatteryType);
  }

  @Get('/default-config/:board')
  @ApiOkResponse({ type: BuildFirmwareDTO })
  getDefaultConfig(@Param('board') board: BoardType): BuildFirmwareDTO {
    const dto = new BuildFirmwareDTO();
    dto.board = new FirmwareBoardDTO();
    dto.board.type = board;

    const imu = new IMUConfigDTO();
    imu.type = IMUType.IMU_MPU6050;

    dto.imus = [imu];

    return BuildFirmwareDTO.completeDefaults(dto);
  }

  @Get('/:id')
  @ApiResponse({ type: Firmware })
  @ApiNotFoundResponse()
  async getFirmware(@Param('id') id: string) {
    try {
      return await this.firmwareService.getFirmware(id);
    } catch {
      throw new HttpException('Firmware not found', HttpStatus.NOT_FOUND);
    }
  }
}
