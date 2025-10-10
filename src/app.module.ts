import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { FirmwareModule } from './firmware/firmware.module';
import { DATABASE_URL } from './env';
import * as schema from './db.schema';
import { DrizzlePostgresModule } from '@knaadh/nestjs-drizzle-postgres';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { APP_FILTER } from '@nestjs/core';

@Module({
  imports: [
    SentryModule.forRoot(),
    DrizzlePostgresModule.register({
      tag: 'DB',
      postgres: { url: DATABASE_URL },
      config: { schema: { ...schema } },
    }),
    FirmwareModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
})
export class AppModule {}
