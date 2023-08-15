import {
  Body,
  Controller,
  Get,
  Header,
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
import { BuildResponseDTO } from './dto/build-response.dto';
import { IMUDTO, IMUS } from './dto/imu.dto';
import { VersionNotFoundError } from './errors/version-not-found.error';
import { FirmwareService } from './firmware.service';
import { FirmwareDTO } from './dto/firmware.dto';
import { BatteryType, BoardType } from '@prisma/client';
import { CreateBuildFirmwareDTO } from './dto/build-firmware.dto';
import { AVAILABLE_BOARDS } from './firmware.constants';
import { DefaultBuildConfigDTO } from './dto/default-config.dto';

@ApiTags('firmware')
@Controller('firmwares')
export class FirmwareController {
  constructor(
    private firmwareService: FirmwareService,
  ) { }

  @Get('/')
  @Header('Cache-Control', 'public, max-age=7200')
  @ApiOkResponse({ type: [FirmwareDTO] })
  getFirmwares() {
    return this.firmwareService.getFirmwares();
  }

  @Post('/build')
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({
    description: 'Build a specific configuration of the firmware',
  })
  @ApiOkResponse({ type: BuildResponseDTO })
  @ApiBadRequestResponse({ description: VersionNotFoundError })
  async buildFirmware(@Body() body: CreateBuildFirmwareDTO) {
    return this.firmwareService.buildFirmware(body);
  }

  @Sse('/build-status/:id')
  @Header('Cache-Control', 'no-cache')
  buildStatus(@Param('id') id: string) {
    return this.firmwareService.getBuildStatusSubject(id);
  }

  @Get('/boards')
  @Header('Cache-Control', 'public, max-age=7200')
  @ApiOkResponse({ type: [String] })
  getBoardsTypes(): string[] {
    return Object.keys(BoardType);
  }

  @Get('/versions')
  @Header('Cache-Control', 'public, max-age=7200')
  @ApiOkResponse({ type: [ReleaseDTO] })
  async getVersions(): Promise<ReleaseDTO[]> {
    return this.firmwareService.getAllReleases();
  }

  @Get('/imus')
  @Header('Cache-Control', 'public, max-age=7200')
  @ApiOkResponse({ type: [IMUDTO] })
  getIMUSTypes(): IMUDTO[] {
    return IMUS;
  }

  @Get('/batteries')
  @Header('Cache-Control', 'public, max-age=7200')
  @ApiOkResponse({ type: [String] })
  getBatteriesTypes(): string[] {
    return Object.keys(BatteryType);
  }

  @Get('/default-config/:board')
  @Header('Cache-Control', 'public, max-age=7200')
  @ApiOkResponse({ type: DefaultBuildConfigDTO })
  getDefaultConfig(@Param('board') board: BoardType): DefaultBuildConfigDTO {
    const buildConfig = new DefaultBuildConfigDTO();
    buildConfig.boardConfig = {
      ...AVAILABLE_BOARDS[board].defaults,
      batteryType: AVAILABLE_BOARDS[board].defaults.batteryType as BatteryType, // oof
      type: board,
    };
    buildConfig.imuPins = AVAILABLE_BOARDS[board].imuPins;

    return buildConfig;
  }

  @Get('/:id')
  @Header('Cache-Control', 'no-cache')
  @ApiResponse({ type: FirmwareDTO })
  @ApiNotFoundResponse()
  async getFirmware(@Param('id') id: string) {
    try {
      return await this.firmwareService.getFirmware(id);
    } catch {
      throw new HttpException('Firmware not found', HttpStatus.NOT_FOUND);
    }
  }
}
