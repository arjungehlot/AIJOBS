import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { env } from './common/env';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: env.webUrl });
  // Screenshots arrive as base64 JSON; the service enforces the real 8 MB image limit.
  app.useBodyParser('json', { limit: '14mb' });
  await app.listen(env.port);
  console.log(`JobPilot API listening on :${env.port}/api/v1`);
}
bootstrap();
