import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { MailMessage } from './mail.types';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly driver: 'console' | 'smtp';
  private readonly from: string;
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {
    const configured = (this.config.get<string>('MAIL_DRIVER') ?? 'console').toLowerCase();
    this.driver = configured === 'smtp' ? 'smtp' : 'console';
    this.from =
      this.config.get<string>('MAIL_FROM') ?? 'AgroBridge <noreply@agrobridge.local>';
  }

  onModuleInit() {
    if (this.driver !== 'smtp') {
      this.logger.log('Mail driver: console (emails logged, not sent)');
      return;
    }

    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn('MAIL_DRIVER=smtp but SMTP_HOST is missing; falling back to console');
      return;
    }

    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const secure =
      (this.config.get<string>('SMTP_SECURE') ?? 'false').toLowerCase() === 'true';
    const user = this.config.get<string>('SMTP_USER') ?? undefined;
    const pass = this.config.get<string>('SMTP_PASSWORD') ?? undefined;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    this.logger.log(`Mail driver: smtp (${host}:${port})`);
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[console-mail] to=${message.to} subject=${JSON.stringify(message.subject)}${message.replyTo ? ` replyTo=${message.replyTo}` : ''}\n${message.text}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
