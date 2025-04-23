import * as Sentry from '@sentry/nestjs';
import { configService, EnvType } from 'src/config/config.service';

if (configService.getSentryUrl()) {
  Sentry.init({
    dsn: `${configService.getSentryUrl()}`,
    environment:
      configService.appEnv() == EnvType.PROD ? 'production' : 'development',
  });
}
