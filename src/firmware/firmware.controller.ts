import {
  Controller,
  Header,
  HttpException,
  HttpStatus,
  Sse,
} from '@nestjs/common';
import { TypedBody, TypedParam, TypedQuery, TypedRoute } from '@nestia/core';
import { ApiTags } from '@nestjs/swagger';
import type {
  BoardDefaultsQuery,
  BuildFirmwareBody,
  BuildStatus,
  FirmwareBoardDefaults,
  FirmwareSource,
  FirmwareWithFiles,
} from './firmware.types';
import { FirmwareService } from './firmware.service';
import { Observable } from 'rxjs';

@ApiTags('firmwares')
@Controller('/firmware')
export class FirmwareController {
  constructor(public firmwareService: FirmwareService) {}

  /**
   * List all the sources you can build a firmware from
   */
  @TypedRoute.Get('/sources')
  @Header('Cache-Control', 'public, max-age=7200')
  sources(): FirmwareSource[] {
    return this.firmwareService.getSources();
  }

  /**
   * Fet the defaults of a specific board on a specific firmware
   *
   * @param board Board name
   * @param source repo path (ex: Slimevr/Slimevr-ESP)
   *
   */
  @TypedRoute.Get('/board-defaults')
  @Header('Cache-Control', 'public, max-age=7200')
  boardDefaults(
    @TypedQuery() query: BoardDefaultsQuery,
  ): FirmwareBoardDefaults | null {
    return this.firmwareService.getBoard(
      query.source,
      query.version,
      query.board,
    );
  }

  @TypedRoute.Post('/build')
  buildFirmware(@TypedBody() body: BuildFirmwareBody) {
    return this.firmwareService.buildFirmware(body);
  }

  /**
   * Get the build status of a firmware
   * This is a SSE (Server Sent Event)
   * it is a special type of request ou of the REST spec.
   * see {@link https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events}
   *
   * We set it as internal to make nestia ignore it, as OpenAPI standard cannot handle SSE
   * @internal
   */
  @Sse('/build-status/:id')
  @Header('Cache-Control', 'no-cache')
  buildStatus(@TypedParam('id') id: string): Observable<{ data: BuildStatus }> {
    return this.firmwareService.getBuildStatusSubject(id);
  }

  /**
   * Get the inforamtions about a firmware from its id
   * also provide more informations than the simple list, like pins and imus and files
   */
  @TypedRoute.Get('/:id')
  @Header('Cache-Control', 'no-cache')
  // @TypedException<HttpException>(HttpStatus.NOT_FOUND, 'Firmware not found')
  async getFirmware(@TypedParam('id') id: string): Promise<FirmwareWithFiles> {
    const firmware = await this.firmwareService.getFirmware(id);
    if (!firmware)
      throw new HttpException('Firmware not found', HttpStatus.NOT_FOUND);
    return firmware;
  }
}
