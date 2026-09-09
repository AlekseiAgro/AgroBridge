import { Global, Module } from '@nestjs/common';
import { PrismaRateLimitStore } from './prisma-rate-limit.store';
import { RateLimitConfig } from './rate-limit.config';
import { RateLimitService } from './rate-limit.service';
import { RATE_LIMIT_STORE } from './rate-limit.types';

/** Global so every feature module can throttle without repeating the wiring. */
@Global()
@Module({
  providers: [
    RateLimitConfig,
    PrismaRateLimitStore,
    { provide: RATE_LIMIT_STORE, useExisting: PrismaRateLimitStore },
    RateLimitService,
  ],
  exports: [RateLimitService, RateLimitConfig],
})
export class RateLimitModule {}
