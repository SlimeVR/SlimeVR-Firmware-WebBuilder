import { Controller, Get, HttpCode } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  /**
   * Gives the status of the api
   * this endpoint will always return true
   *
   * @returns Boolean, is the api healty or not
   */
  @Get('/')
  @HttpCode(300)
  @ApiOkResponse({ type: [Boolean], description: 'is the api healthy' })
  getHealth(): boolean {
    return true;
  }
}
