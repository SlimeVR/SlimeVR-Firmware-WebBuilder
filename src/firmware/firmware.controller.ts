import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BuildFirmwareDTO } from './dto/build-firmware.dto';
import { Firmware } from './entity/firmware.entity';
import { VersionNotFoundError } from './errors/version-not-found.error';
import { FirmwareService } from './firmware.service';

@ApiTags('slimevr')
@Controller('firmwares')
export class FirmwareController {
  constructor(private firmwareService: FirmwareService) {}

  @Get('/')
  @ApiResponse({ type: [Firmware] })
  getFirmwares() {
    return this.firmwareService.getFirmwares();
  }

  @Post('/build')
  @ApiOperation({
    description: 'Build a specific configuration of the firmware',
  })
  @ApiBadRequestResponse({ description: VersionNotFoundError })
  async buildAll(@Body() body: BuildFirmwareDTO) {
    return this.firmwareService.buildFirmware(body);
  }
}
