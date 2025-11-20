import { Module } from '@nestjs/common';
import { FirmwareController } from './firmware.controller';
import { FirmwareService } from './firmware.service';
import { AwsSdkModule } from 'aws-sdk-v3-nest';
import { S3Client } from '@aws-sdk/client-s3';
import { getS3Config } from 'src/env';
import { PlatformIOService } from './platformio.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AwsSdkModule.registerAsync({
      clientType: S3Client,
      useFactory: async () => new S3Client(await getS3Config()),
    }),
  ],
  controllers: [FirmwareController],
  providers: [FirmwareService, PlatformIOService],
})
export class FirmwareModule {}
