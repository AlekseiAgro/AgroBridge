import { ConfigService } from '@nestjs/config';
import { SUPPORT_EMAIL } from '@agrobridge/shared';
import type { MailService } from '../mail/mail.service';
import { SupportService } from './support.service';

describe('SupportService', () => {
  it('sends a support request to the configured inbox', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const service = new SupportService(
      { send } as unknown as MailService,
      {
        get: () => undefined,
      } as ConfigService,
    );

    await expect(
      service.submit({
        name: 'Nino',
        email: 'nino@example.com',
        subject: 'Catalog question',
        message: 'How do I publish a product?',
      }),
    ).resolves.toEqual({ ok: true });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: SUPPORT_EMAIL,
        replyTo: 'nino@example.com',
        subject: '[Support] Catalog question',
      }),
    );
  });
});
