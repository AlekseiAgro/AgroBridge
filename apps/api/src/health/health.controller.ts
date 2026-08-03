import { Controller, Get } from '@nestjs/common';
import { LOCALES } from '@agrobridge/shared';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'agrobridge-api',
      locales: LOCALES,
      timestamp: new Date().toISOString(),
    };
  }
}
