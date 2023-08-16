import { Module } from '@nestjs/common';
import { FirmwareModule } from './firmware/firmware.module';
import { CacheModule } from '@nestjs/cache-manager';
import { HealthModule } from './health/health.module';

@Module({
  imports: [CacheModule.register(), FirmwareModule, HealthModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class AppModule {}
