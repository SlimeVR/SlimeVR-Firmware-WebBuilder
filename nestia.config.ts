import { INestiaConfig } from '@nestia/sdk';
import { NestFactory } from '@nestjs/core';
// import { FastifyAdapter } from "@nestjs/platform-fastify";

import { AppModule } from 'src/app.module';

const camelize = (word: string, index: number) =>
  !word || index == 0 ? word : word[0].toUpperCase() + word.slice(1);

const NESTIA_CONFIG: INestiaConfig = {
  input: async () => {
    const app = await NestFactory.create(AppModule);
    // const app = await NestFactory.create(YourModule, new FastifyAdapter());
    // app.setGlobalPrefix("api");
    // app.enableVersioning({
    //     type: VersioningType.URI,
    //     prefix: "v",
    // })
    return app;
  },
  swagger: {
    output: 'dist/swagger.json',
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local Server',
      },
    ],
    beautify: true,
    openapi: '3.0',
    operationId: ({ path, method }) =>
      `${method.toLowerCase()}_${path.substring(1).replace(/\/|-|{|}/gi, '_')}`
        .split('_')
        .map(camelize)
        .join(''),
  },
};
export default NESTIA_CONFIG;
