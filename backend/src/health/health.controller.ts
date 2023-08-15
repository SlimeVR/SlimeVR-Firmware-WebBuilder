import { TypedRoute } from '@nestia/core';
import { Controller } from '@nestjs/common';

@Controller('health')
export class HealthController {
  /**
   *
   * @tag health
   *
   * @returns is the api healthy or not
   */
  @TypedRoute.Get('/')
  // @HttpCode(300)
  getHealth(): boolean {
    return true;
  }
}
