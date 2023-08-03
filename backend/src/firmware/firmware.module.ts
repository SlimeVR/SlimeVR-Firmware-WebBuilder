import { Module } from '@nestjs/common';
import { configProvider, configService } from 'src/config/config.service';
import { GithubModule } from 'src/github/github.module';
import { FirmwareController } from './firmware.controller';
import { FirmwareService } from './firmware.service';
import { AwsSdkModule } from 'aws-sdk-v3-nest';
import { S3Client } from '@aws-sdk/client-s3';

@Module({
  imports: [
    GithubModule,
    AwsSdkModule.registerAsync({
      clientType: S3Client,
      useFactory: async () => new S3Client(await configService.getS3Config()),
    }),
  ],
  controllers: [FirmwareController],
  providers: [FirmwareService, configProvider],
})
export class FirmwareModule {}
