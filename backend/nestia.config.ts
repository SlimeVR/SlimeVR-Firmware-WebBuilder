import { INestiaConfig } from '@nestia/sdk';
import { configService } from './src/config/config.service';

const camelize = (word: string, index: number) =>
  !word || index == 0 ? word : word[0].toUpperCase() + word.slice(1);

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
    openapi: '3.0',
    operationId: ({ path, method }) =>
      `${method.toLowerCase()}_${path.substring(1).replace(/\/|-|{|}/gi, '_')}`
        .split('_')
        .map(camelize)
        .join(''),
  },
};
export default config;
