import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import {
  describeMailConfig,
  isTransientSmtpError,
  MAIL_RETRY_DELAYS_MS,
  MAIL_SEND_ATTEMPTS,
  resolveMailConfig,
  sanitizeMailError,
  SMTP_CONNECTION_TIMEOUT_MS,
  SMTP_GREETING_TIMEOUT_MS,
  SMTP_SOCKET_TIMEOUT_MS,
  type MailSettings,
} from './mail.config';
import {
  classifyResendError,
  isTransientResendError,
  sendResendHttp,
} from './resend-http';
import type { MailMessage } from './mail.types';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly settings: MailSettings;
  private transporter?: Transporter;
  private fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis);

  constructor(private readonly config: ConfigService) {
    this.settings = resolveMailConfig(this.config);
    if (this.settings.driver === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: this.settings.host,
        port: this.settings.port,
        secure: this.settings.secure,
        // Port 587: require STARTTLS. Port 465 (secure=true) already wraps the socket.
        requireTLS: !this.settings.secure,
        auth: { user: this.settings.user, pass: this.settings.password },
        connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
        greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
        socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
        tls: { minVersion: 'TLSv1.2' },
      });
    }
  }

  onModuleInit() {
    this.logger.log(describeMailConfig(this.settings));
  }

  async send(message: MailMessage): Promise<void> {
    if (this.settings.driver === 'console') {
      this.logConsole(message);
      return;
    }

    if (this.settings.driver === 'resend') {
      await this.sendResend(message);
      return;
    }

    await this.sendSmtp(message);
  }

  private async sendResend(message: MailMessage): Promise<void> {
    if (this.settings.driver !== 'resend') {
      throw new Error('Resend transport is not configured');
    }

    const { apiKey, from } = this.settings;
    const secrets = [apiKey];

    for (let attempt = 1; attempt <= MAIL_SEND_ATTEMPTS; attempt += 1) {
      try {
        await sendResendHttp({
          apiKey,
          from,
          message,
          fetchImpl: this.fetchImpl,
        });
        this.logger.log(`Resend send ok attempt=${attempt}`);
        return;
      } catch (error) {
        const safe = sanitizeMailError(error, secrets);
        const retry = attempt < MAIL_SEND_ATTEMPTS && isTransientResendError(error);
        const { status, classification } = classifyResendError(error);
        this.logger.error(
          `Resend send failed attempt=${attempt}/${MAIL_SEND_ATTEMPTS} retry=${retry} driver=resend status=${status} class=${classification} detail=${safe}`,
        );
        if (!retry) {
          break;
        }
        await sleep(MAIL_RETRY_DELAYS_MS[attempt - 1] ?? 800);
      }
    }

    throw new Error('Email delivery failed');
  }

  private async sendSmtp(message: MailMessage): Promise<void> {
    const transporter = this.transporter;
    if (!transporter) {
      throw new Error('SMTP transport is not configured');
    }

    const secrets = this.settings.driver === 'smtp' ? [this.settings.password] : [];

    for (let attempt = 1; attempt <= MAIL_SEND_ATTEMPTS; attempt += 1) {
      try {
        await transporter.sendMail({
          from: this.settings.from,
          to: message.to,
          replyTo: message.replyTo,
          subject: message.subject,
          text: message.text,
          html: message.html,
          textEncoding: 'quoted-printable',
        });
        this.logger.log(`SMTP send ok attempt=${attempt}`);
        return;
      } catch (error) {
        const safe = sanitizeMailError(error, secrets);
        const retry = attempt < MAIL_SEND_ATTEMPTS && isTransientSmtpError(error);
        this.logger.error(
          `SMTP send failed attempt=${attempt}/${MAIL_SEND_ATTEMPTS} retry=${retry} to=${message.to} detail=${safe}`,
        );
        if (!retry) {
          break;
        }
        await sleep(MAIL_RETRY_DELAYS_MS[attempt - 1] ?? 800);
      }
    }

    throw new Error('Email delivery failed');
  }

  private logConsole(message: MailMessage): void {
    const header = `[console-mail] to=${message.to} subject=${JSON.stringify(message.subject)}${
      message.replyTo ? ` replyTo=${message.replyTo}` : ''
    }`;
    // Bodies carry verification codes. Printing them is a development convenience only;
    // if this driver is ever reached in production the code must not reach the logs.
    this.logger.log(
      this.settings.redactBodies ? `${header} (body omitted)` : `${header}\n${message.text}`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
