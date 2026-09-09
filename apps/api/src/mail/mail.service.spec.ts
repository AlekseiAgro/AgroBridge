import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

function buildService(env: Record<string, string> = {}) {
  return new MailService({ get: (key: string) => env[key] } as unknown as ConfigService);
}

describe('MailService console driver', () => {
  let logged: string[];

  beforeEach(() => {
    logged = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prints the body during development so codes can be copied from the console', async () => {
    await buildService().send({
      to: 'farmer@example.com',
      subject: 'Verification code',
      text: 'Your AgroBridge code is 123456',
    });

    expect(logged.join('\n')).toContain('123456');
  });

  it('never prints a verification code in production', async () => {
    await buildService({ NODE_ENV: 'production' }).send({
      to: 'farmer@example.com',
      subject: 'Verification code',
      text: 'Your AgroBridge code is 123456',
    });

    const output = logged.join('\n');
    expect(output).not.toContain('123456');
    expect(output).toContain('body omitted');
    expect(output).toContain('farmer@example.com');
  });
});
