import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';

/**
 * PrismaModule is global, so the import is redundant inside the running app. It is declared
 * anyway because the probe now depends on the database: without it the module cannot be
 * bootstrapped on its own, which is exactly what the e2e suite does.
 */
@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
})
export class HealthModule {}
