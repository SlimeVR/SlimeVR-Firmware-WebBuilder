import { Module } from '@nestjs/common';
import { FirmwareModule } from './firmware/firmware.module';
import { CacheModule } from '@nestjs/cache-manager';
import { HealthModule } from './health/health.module';
import { AppController } from './app.controller';

@Module({
  imports: [CacheModule.register(), FirmwareModule, HealthModule],
  controllers: [AppController],
  providers: [],
  exports: [],
})
export class AppModule {}
