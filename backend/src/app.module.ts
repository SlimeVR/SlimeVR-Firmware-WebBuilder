import { CacheModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configService } from './config/config.service';
import { FirmwareModule } from './firmware/firmware.module';

@Module({
  imports: [
    CacheModule.register(),
    TypeOrmModule.forRoot(configService.getTypeOrmConfig()),
    FirmwareModule,
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class AppModule {}
