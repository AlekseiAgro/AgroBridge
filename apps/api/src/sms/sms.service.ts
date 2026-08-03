import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SmsMessage = {
  to: string;
  text: string;
};

/**
 * SMS delivery stub. Stage-1 verification uses a console driver by default.
 * Swap to a real provider later without changing call sites.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly driver: string;

  constructor(private readonly config: ConfigService) {
    this.driver = (this.config.get<string>('SMS_DRIVER') ?? 'console').toLowerCase();
  }

  async send(message: SmsMessage): Promise<void> {
    if (this.driver === 'console') {
      this.logger.log(`[console-sms] to=${message.to} text=${JSON.stringify(message.text)}`);
      return;
    }
    this.logger.warn(`SMS driver "${this.driver}" is not configured; logging instead`);
    this.logger.log(`[fallback-sms] to=${message.to} text=${JSON.stringify(message.text)}`);
  }
}
