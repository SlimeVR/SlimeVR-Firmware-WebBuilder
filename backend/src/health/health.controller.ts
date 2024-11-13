import { TypedRoute } from '@nestia/core';
import { Controller } from '@nestjs/common';

@Controller('health')
export class HealthController {
  /**
   * Gives the status of the api
   * this endpoint will always return true
   *
   * @tag health
   *
   * @returns Boolean, is the api healty or not
   */
  @TypedRoute.Get('/')
  getHealth(): boolean {
    return true;
  }
}
