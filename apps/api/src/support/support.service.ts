import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SUPPORT_EMAIL, type SupportRequestResponse } from '@agrobridge/shared';
import { MailService } from '../mail/mail.service';
import type { CreateSupportRequestDto } from './dto/create-support-request.dto';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);
  private readonly supportEmail: string;

  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    this.supportEmail =
      this.config.get<string>('SUPPORT_EMAIL')?.trim() || SUPPORT_EMAIL;
  }

  async submit(dto: CreateSupportRequestDto): Promise<SupportRequestResponse> {
    const name = dto.name.trim();
    const email = dto.email.trim();
    const subject = dto.subject.trim();
    const message = dto.message.trim();

    const text = [
      'New AgroBridge support request',
      '',
      `Name: ${name}`,
      `Email: ${email}`,
      `Subject: ${subject}`,
      '',
      message,
    ].join('\n');

    const html = `
      <p><strong>New AgroBridge support request</strong></p>
      <p><strong>Name:</strong> ${escapeHtml(name)}<br/>
      <strong>Email:</strong> ${escapeHtml(email)}<br/>
      <strong>Subject:</strong> ${escapeHtml(subject)}</p>
      <p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
    `.trim();

    try {
      await this.mail.send({
        to: this.supportEmail,
        replyTo: email,
        subject: `[Support] ${subject}`,
        text,
        html,
      });
    } catch (error) {
      this.logger.error('Failed to send support request email', error);
      throw error;
    }

    return { ok: true };
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
