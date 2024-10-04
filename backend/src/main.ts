import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import { AppModule } from './app.module';
import swaggerDocument from './swagger.json';

async function bootstrap() {
  process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  });

  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  SwaggerModule.setup('api', app, swaggerDocument as OpenAPIObject, {
    swaggerOptions: {
      defaultModelRendering: 'model',
    },
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true })); // Use Class validator on all endpoints for all input and output payloads
  useContainer(app.select(AppModule), { fallbackOnErrors: true }); // Allow injectable into classvalidator

  await app.listen(3000);
}
bootstrap();
