import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';

function buildService(env: Record<string, string> = {}) {
  return new SmsService({ get: (key: string) => env[key] } as unknown as ConfigService);
}

describe('SmsService console driver', () => {
  let logged: string[];

  beforeEach(() => {
    logged = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prints the message during development', async () => {
    await buildService().send({ to: '+995555123456', text: 'AgroBridge code: 123456' });
    expect(logged.join('\n')).toContain('123456');
    expect(logged.join('\n')).toContain('+995');
    expect(logged.join('\n')).not.toContain('555123456');
  });

  it('never prints a verification code in production', async () => {
    await buildService({
      NODE_ENV: 'production',
      SMS_DRIVER: 'console',
      SMS_ALLOW_CONSOLE: 'true',
    }).send({
      to: '+995555123456',
      text: 'AgroBridge code: 123456',
    });

    const output = logged.join('\n');
    expect(output).toContain('text omitted');
    expect(output).not.toContain('123456');
  });

  it('rejects an unknown SMS driver at construction', () => {
    expect(() => buildService({ SMS_DRIVER: 'twilio' })).toThrow(/console or infobip/);
  });
});
