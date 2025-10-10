import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestiaSwaggerComposer } from '@nestia/sdk';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { PORT } from './env';

import './instrument';
import NESTIA_CONFIG from 'nestia.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });
  const document = await NestiaSwaggerComposer.document(app, {
    ...NESTIA_CONFIG.swagger,
  });

  const openApiDoc = document as OpenAPIObject;

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

  await app.listen(PORT);
}
bootstrap().catch(console.error);
