import { Module } from '@nestjs/common';
import { configProvider, configService } from 'src/config/config.service';
import { GithubModule } from 'src/github/github.module';
import { FirmwareController } from './firmware.controller';
import { FirmwareService } from './firmware.service';
import { S3Module } from 'nestjs-s3';

@Module({
  imports: [
    GithubModule,
    S3Module.forRootAsync({
      useFactory: () => configService.getS3Config(),
    }),
  ],
  controllers: [FirmwareController],
  providers: [FirmwareService, configProvider],
})
export class FirmwareModule {}
