import './instrument';

import { NestFactory } from '@nestjs/core';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

import swaggerDocument from './swagger.json';

async function bootstrap() {
  process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  });

  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  const openApiDoc = swaggerDocument as OpenAPIObject;

  openApiDoc.servers = [];

  SwaggerModule.setup('api', app, openApiDoc, {
    swaggerOptions: {
      defaultModelRendering: 'model',
      tryItOutEnabled: true,
      syntaxHighlight: {
        activate: true,
      },
    },
  });
  await app.listen(3000);
}
bootstrap();
