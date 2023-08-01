import { CacheModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirmwareModule } from './firmware/firmware.module';
import { connectionSource } from './config/typeorm.datasource';

@Module({
  imports: [
    CacheModule.register(),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({}),
      dataSourceFactory: async () => {
        return connectionSource.initialize();
      },
    }),
    FirmwareModule,
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class AppModule {}
