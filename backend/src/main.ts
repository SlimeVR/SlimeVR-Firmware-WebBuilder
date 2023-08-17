import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import { AppModule } from './app.module';
import { configService } from './config/config.service';
import swaggerDocument from './swagger.json';

async function bootstrap() {
  process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  });

  const corsWhitelist = [
    configService.getHostUrl(),
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || corsWhitelist.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS: ' + origin));
        }
      },
    },
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
