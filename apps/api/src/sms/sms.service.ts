import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { maskPhoneNumber } from '@agrobridge/shared';
import {
  describeSmsConfig,
  resolveSmsConfig,
  sanitizeSmsError,
  type SmsSettings,
} from './sms.config';
import { SMS_UNAVAILABLE_CLIENT_MESSAGE, SmsDeliveryError } from './sms.errors';
import { classifyInfobipFailure, sendInfobipSms } from './infobip-sms';
import type { SmsMessage } from './sms.types';

export type { SmsMessage } from './sms.types';

@Injectable()
export class SmsService implements OnModuleInit {
  private readonly logger = new Logger(SmsService.name);
  private readonly settings: SmsSettings;
  private fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis);

  constructor(private readonly config: ConfigService) {
    this.settings = resolveSmsConfig(this.config);
  }

  onModuleInit() {
    this.logger.log(describeSmsConfig(this.settings));
  }

  async send(message: SmsMessage): Promise<void> {
    if (this.settings.driver === 'console') {
      this.logger.log(
        `[console-sms] to=${maskPhoneNumber(message.to)} ${this.body(message.text)}`,
      );
      return;
    }

    try {
      await sendInfobipSms({
        settings: this.settings,
        message,
        fetchImpl: this.fetchImpl,
      });
      this.logger.log(`SMS accepted to=${maskPhoneNumber(message.to)}`);
    } catch (error) {
      const classification = classifyInfobipFailure(error);
      const secrets = this.settings.driver === 'infobip' ? [this.settings.apiKey] : [];
      this.logger.warn(
        `SMS delivery failed to=${maskPhoneNumber(message.to)} kind=${classification} ${sanitizeSmsError(error, secrets)}`,
      );
      if (error instanceof SmsDeliveryError) {
        throw error;
      }
      throw new SmsDeliveryError('unavailable', SMS_UNAVAILABLE_CLIENT_MESSAGE);
    }
  }

  private body(text: string): string {
    return this.settings.redactBodies ? '(text omitted)' : `text=${JSON.stringify(text)}`;
  }
}
