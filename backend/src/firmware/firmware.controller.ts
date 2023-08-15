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

  /**
   * List all the built firmwares
   */
  @Get('/')
  @Header('Cache-Control', 'public, max-age=7200')
  @ApiOkResponse({ type: [FirmwareDTO], description: 'List all the built firmwares' })
  getFirmwares() {
    return this.firmwareService.getFirmwares();
  }

  /**
   * Build a firmware from the requested configuration 
   */
  @Post('/build')
  @Header('Cache-Control', 'no-cache')
  @ApiOkResponse({ type: BuildResponseDTO, description: 'Build a specific configuration of the firmware', })
  @ApiBadRequestResponse({ description: VersionNotFoundError })
  async buildFirmware(@Body() body: CreateBuildFirmwareDTO) {
    return this.firmwareService.buildFirmware(body);
  }


  /**
   * Get the build status of a firmware
   * This is a SSE (Server Sent Event)
   * you can use the web browser api to check for the build status and update the ui in real time 
   */
  @Sse('/build-status/:id')
  @Header('Cache-Control', 'no-cache')
  buildStatus(@Param('id') id: string) {
    return this.firmwareService.getBuildStatusSubject(id);
  }

  /**
   * List all the possible board types
   */
  @Get('/boards')
  @Header('Cache-Control', 'public, max-age=7200')
  @ApiOkResponse({
    schema: {
      anyOf: Object.keys(BoardType) // I really dont know about this ....
        .map(() => ({
          oneOf: Object.keys(BatteryType).map((type) => ({
            type,
          })),
        })),
    },
    description: 'List all the possible board types'
  })
  getBoardsTypes(): string[] {
    return Object.keys(BoardType);
  }

  /**
   * List all the possible versions to build a firmware from
   */
  @Get('/versions')
  @Header('Cache-Control', 'public, max-age=7200')
  @ApiOkResponse({ type: [ReleaseDTO], description: 'List all the possible versions to build a firmware from' })
  async getVersions(): Promise<ReleaseDTO[]> {
    return this.firmwareService.getAllReleases();
  }

  /**
   * List all the possible imus to use
   */
  @Get('/imus')
  @Header('Cache-Control', 'public, max-age=7200')
  @ApiOkResponse({ type: [IMUDTO], description: 'List all the possible imus to use' })
  getIMUSTypes(): IMUDTO[] {
    return IMUS;
  }

  /**
   * List all the battery types
   */
  @Get('/batteries')
  @Header('Cache-Control', 'public, max-age=7200')
  @ApiOkResponse({ type: [String], description: 'List all the battery types' })
  getBatteriesTypes(): string[] {
    return Object.keys(BatteryType);
  }

  /**
   * Gives the default pins / configuration of a given board
   */
  @Get('/default-config/:board')
  @Header('Cache-Control', 'public, max-age=7200')
  @ApiOkResponse({ type: DefaultBuildConfigDTO, description: 'Gives the default pins / configuration of a given board' })
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

  /**
   * Get the inforamtions about a firmware from its id 
   */
  @Get('/:id')
  @Header('Cache-Control', 'no-cache')
  @ApiResponse({ type: FirmwareDTO, description: 'Get the inforamtions about a firmware from its id' })
  @ApiNotFoundResponse()
  async getFirmware(@Param('id') id: string) {
    try {
      return await this.firmwareService.getFirmware(id);
    } catch {
      throw new HttpException('Firmware not found', HttpStatus.NOT_FOUND);
    }
  }
}
