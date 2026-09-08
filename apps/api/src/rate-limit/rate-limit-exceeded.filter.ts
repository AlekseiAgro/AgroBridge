import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { RateLimitExceededException } from './rate-limit-exceeded.exception';

/** Adds `Retry-After` to throttled responses so clients can back off instead of hammering. */
@Catch(RateLimitExceededException)
export class RateLimitExceededFilter implements ExceptionFilter {
  catch(exception: RateLimitExceededException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    response.status(HttpStatus.TOO_MANY_REQUESTS).json(exception.getResponse());
  }
}
