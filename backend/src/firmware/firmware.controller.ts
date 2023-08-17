import {
  Body,
  Controller,
  Header,
  HttpException,
  HttpStatus,
  Param,
  Sse,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReleaseDTO } from 'src/github/dto/release.dto';
import { BuildResponseDTO, BuildStatusMessage } from './dto/build-response.dto';
import { IMUDTO, IMUS } from './dto/imu.dto';
import {
  VersionNotFoundError,
  VersionNotFoundExeption,
  VersionNotFoundStatus,
} from './errors/version-not-found.error';
import { FirmwareService } from './firmware.service';
import { FirmwareDTO } from './dto/firmware.dto';
import { BatteryType, BoardType } from '@prisma/client';
import { CreateBuildFirmwareDTO } from './dto/build-firmware.dto';
import { AVAILABLE_BOARDS } from './firmware.constants';
import { DefaultBuildConfigDTO } from './dto/default-config.dto';
import { FirmwareBuilderService } from './firmware-builder.service';
import { Observable } from 'rxjs';
import { TypedException, TypedRoute } from '@nestia/core';

@ApiTags('firmware')
@Controller('firmwares')
export class FirmwareController {
  constructor(
    private firmwareService: FirmwareService,
    private firmwareBuilderService: FirmwareBuilderService,
  ) {}

  /**
   * List all the built firmwares
   */
  @TypedRoute.Get('/')
  @Header('Cache-Control', 'public, max-age=7200')
  async getFirmwares(): Promise<FirmwareDTO[]> {
    return this.firmwareService.getFirmwares();
  }

  /**
   * Build a firmware from the requested configuration
   *
   */
  @TypedRoute.Post('/build')
  @Header('Cache-Control', 'no-cache')
  @TypedException<VersionNotFoundExeption>(
    VersionNotFoundStatus,
    VersionNotFoundError,
  )
  async buildFirmware(
    @Body() body: CreateBuildFirmwareDTO,
  ): Promise<BuildResponseDTO> {
    return this.firmwareBuilderService.buildFirmware(body);
  }

  /**
   * Get the build status of a firmware
   * This is a SSE (Server Sent Event)
   * you can use the web browser api to check for the build status and update the ui in real time
   *
   * @internal
   */
  @Sse('/build-status/:id')
  @Header('Cache-Control', 'no-cache')
  buildStatus(
    @Param('id') id: string,
  ): Observable<{ data: BuildStatusMessage }> {
    return this.firmwareBuilderService.getBuildStatusSubject(id);
  }

  /**
   * List all the possible board types
   */
  @TypedRoute.Get('/boards')
  @Header('Cache-Control', 'public, max-age=7200')
  getBoardsTypes(): string[] {
    return Object.keys(BoardType);
  }

  /**
   * List all the possible versions to build a firmware from
   */
  @TypedRoute.Get('/versions')
  @Header('Cache-Control', 'public, max-age=7200')
  async getVersions(): Promise<ReleaseDTO[]> {
    return this.firmwareService.getAllReleases();
  }

  /**
   * List all the possible imus to use
   */
  @TypedRoute.Get('/imus')
  @Header('Cache-Control', 'public, max-age=7200')
  getIMUSTypes(): IMUDTO[] {
    return IMUS;
  }

  /**
   * List all the battery types
   */
  @TypedRoute.Get('/batteries')
  @Header('Cache-Control', 'public, max-age=7200')
  getBatteriesTypes(): string[] {
    return Object.keys(BatteryType);
  }

  /**
   * Gives the default pins / configuration of a given board
   */
  @TypedRoute.Get('/default-config/:board')
  @Header('Cache-Control', 'public, max-age=7200')
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
  @TypedRoute.Get('/:id')
  @Header('Cache-Control', 'no-cache')
  @TypedException<HttpException>(HttpStatus.NOT_FOUND, 'Firmware not found')
  async getFirmware(@Param('id') id: string): Promise<FirmwareDTO> {
    try {
      return await this.firmwareService.getFirmware(id);
    } catch {
      throw new HttpException('Firmware not found', HttpStatus.NOT_FOUND);
    }
  }
}
