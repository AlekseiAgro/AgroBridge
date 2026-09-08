import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { resolveTrustProxyHops } from './http/client-ip';
import { RateLimitConfig } from './rate-limit/rate-limit.config';
import { RateLimitExceededFilter } from './rate-limit/rate-limit-exceeded.filter';

function assertProductionSecrets() {
  if (process.env.NODE_ENV !== 'production') return;

  const secret = process.env.JWT_SECRET?.trim() ?? '';
  if (!secret || secret === 'change-me-in-production') {
    throw new Error(
      'JWT_SECRET must be set to a strong non-default value in production',
    );
  }
}

async function bootstrap() {
  assertProductionSecrets();

  // Throws on a malformed value rather than silently trusting a forged X-Forwarded-For.
  const trustProxyHops = resolveTrustProxyHops(process.env);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Rate limiting is only as good as the address it counts, so this must match the number
  // of reverse proxies actually in front of the API. See resolveTrustProxyHops.
  app.set('trust proxy', trustProxyHops);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.WEB_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new RateLimitExceededFilter());

  const logger = new Logger('Bootstrap');
  logger.log(`Trusted proxy hops: ${trustProxyHops}`);
  logger.log(`Rate limits: ${app.get(RateLimitConfig).describe()}`);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
