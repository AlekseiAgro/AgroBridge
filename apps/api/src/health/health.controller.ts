import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { LOCALES } from '@agrobridge/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * A probe that only proves the process is alive is worse than none: Railway keeps routing
 * traffic to an instance whose every request already fails at Prisma. The database is the
 * one dependency without which nothing works, so it is what the check actually asks about.
 */
const DATABASE_PROBE_TIMEOUT_MS = 3000;

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const body = {
      service: 'agrobridge-api',
      locales: LOCALES,
      timestamp: new Date().toISOString(),
    };

    if (!(await this.databaseReachable())) {
      // 503 rather than a 200 carrying bad news: load balancers read the status code.
      throw new ServiceUnavailableException({
        ...body,
        status: 'error',
        database: 'unavailable',
      });
    }

    return { ...body, status: 'ok', database: 'ok' };
  }

  /**
   * A hung connection must not hold the probe open until the platform's own timeout, or the
   * instance looks merely slow instead of broken.
   */
  private async databaseReachable(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('database probe timed out')),
          DATABASE_PROBE_TIMEOUT_MS,
        );
      });
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);
      return true;
    } catch (error) {
      this.logger.error(
        `Health probe could not reach the database: ${
          error instanceof Error ? error.message.split('\n')[0] : 'unknown error'
        }`,
      );
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
