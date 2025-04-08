import * as Sentry from '@sentry/nestjs';
import { configService, EnvType } from 'src/config/config.service';

Sentry.init({
  dsn: 'https://08678a309f80649863062cdf85edd36d@o4507810483535872.ingest.de.sentry.io/4509117541843024',
  environment:
    configService.appEnv() == EnvType.PROD ? 'production' : 'development',
});
