import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('MailService', () => {
  it('logs messages in console driver', async () => {
    const service = new MailService({
      get: (key: string) => {
        if (key === 'MAIL_DRIVER') return 'console';
        if (key === 'MAIL_FROM') return 'AgroBridge <test@example.com>';
        return undefined;
      },
    } as ConfigService);

    service.onModuleInit();
    await expect(
      service.send({
        to: 'user@example.com',
        subject: 'Hello',
        text: 'Body',
      }),
    ).resolves.toBeUndefined();
  });
});
