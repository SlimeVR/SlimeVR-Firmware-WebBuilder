import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import { AppModule } from './app.module';

async function bootstrap() {
  const corsWhitelist = [
    'https://slimevr-firmware-tool.futurabeast.com',
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

  const config = new DocumentBuilder()
    .setTitle('Slimevr API')
    .setDescription('Slimy things')
    .setVersion('1.0')
    .addTag('slimevr')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      defaultModelRendering: 'model',
    },
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  useContainer(app.select(AppModule), { fallbackOnErrors: true }); // Allow injectable into classvalidator

  await app.listen(3000);
}
bootstrap();
