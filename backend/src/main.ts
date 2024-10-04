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

  SwaggerModule.setup('api', app, swaggerDocument as OpenAPIObject, {
    swaggerOptions: {
      defaultModelRendering: 'model',
    },
  });
  await app.listen(3000);
}
bootstrap();
