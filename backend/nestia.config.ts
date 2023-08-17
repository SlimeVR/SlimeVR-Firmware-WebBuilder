import { INestiaConfig } from '@nestia/sdk';
import { configService } from './src/config/config.service';

const config: INestiaConfig = {
  input: 'src/**/*.controller.ts',
  swagger: {
    output: 'src/swagger.json',
    servers: [
      {
        url: configService.getHostUrl(),
        description: 'Main Server',
      },
    ],
  },
};
export default config;
