import { Controller, Get } from '@nestjs/common';

@Controller('firmwares')
export class FirmwareController {
  @Get('/')
  getFirmwares() {
    return;
  }
}
