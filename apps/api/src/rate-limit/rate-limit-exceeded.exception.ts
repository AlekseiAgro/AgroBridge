import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 429 response for an exhausted limit. The message stays deliberately generic: it must not
 * reveal which of the combined counters tripped, because that would leak whether an email
 * belongs to an existing account.
 */
export class RateLimitExceededException extends HttpException {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = 'Too many attempts. Try again later.') {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message,
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
