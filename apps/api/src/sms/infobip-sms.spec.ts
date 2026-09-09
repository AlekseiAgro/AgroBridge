import { SmsDeliveryError } from './sms.errors';
import { sendInfobipSms, toInfobipDestination } from './infobip-sms';
import type { InfobipSmsSettings } from './sms.config';

const settings: InfobipSmsSettings = {
  driver: 'infobip',
  redactBodies: true,
  apiKey: 'test-infobip-key-value',
  baseUrl: 'https://abcd12.api.infobip.com',
  sender: 'InfoSMS',
  timeoutMs: 50,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const accepted = {
  messages: [{ to: '995555123456', status: { groupId: 1, groupName: 'PENDING' } }],
};

describe('sendInfobipSms', () => {
  it('sends an HTTPS Infobip payload with App authorization', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, accepted));

    await sendInfobipSms({
      settings,
      message: { to: '+995555123456', text: 'AgroBridge verification code: 123456' },
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://abcd12.api.infobip.com/sms/2/text/advanced');
    expect(init.redirect).toBe('error');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('App test-infobip-key-value');
    const body = JSON.parse(String(init.body)) as {
      messages: Array<{ from: string; destinations: Array<{ to: string }>; text: string }>;
    };
    expect(body.messages[0].from).toBe('InfoSMS');
    expect(body.messages[0].destinations[0].to).toBe('995555123456');
    expect(body.messages[0].text).toContain('123456');
  });

  it('maps HTTP 400 to an invalid-destination client error without leaking the key', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(400, { requestError: { serviceException: { text: 'invalid' } } }),
    );

    const error = await sendInfobipSms({
      settings,
      message: { to: '+995555123456', text: 'code 123456' },
      fetchImpl,
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SmsDeliveryError);
    expect((error as SmsDeliveryError).kind).toBe('invalid_destination');
    expect((error as Error).message).not.toContain('test-infobip-key-value');
  });

  it('maps provider HTTP 500 to unavailable', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(500, { error: 'down' }));
    const error = await sendInfobipSms({
      settings,
      message: { to: '+995555123456', text: 'code 123456' },
      fetchImpl,
    }).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(SmsDeliveryError);
    expect((error as SmsDeliveryError).kind).toBe('unavailable');
  });

  it('maps a rejected Infobip group to a safe client error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        messages: [{ status: { groupId: 5, groupName: 'REJECTED' } }],
      }),
    );
    const error = await sendInfobipSms({
      settings,
      message: { to: '+995555123456', text: 'code 123456' },
      fetchImpl,
    }).catch((err: unknown) => err);
    expect((error as SmsDeliveryError).kind).toBe('rejected');
  });

  it('treats a malformed provider body as unavailable', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response('<<<not-json>>>', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    );
    const error = await sendInfobipSms({
      settings,
      message: { to: '+995555123456', text: 'code 123456' },
      fetchImpl,
    }).catch((err: unknown) => err);
    expect((error as SmsDeliveryError).kind).toBe('unavailable');
  });

  it('does not retry after a timeout, so a single user action cannot send two SMS', async () => {
    const fetchImpl = jest.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    const error = await sendInfobipSms({
      settings,
      message: { to: '+995555123456', text: 'code 123456' },
      fetchImpl,
    }).catch((err: unknown) => err);

    expect((error as SmsDeliveryError).kind).toBe('timeout');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps a network failure to unavailable without a second request', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    const error = await sendInfobipSms({
      settings,
      message: { to: '+995555123456', text: 'code 123456' },
      fetchImpl,
    }).catch((err: unknown) => err);
    expect((error as SmsDeliveryError).kind).toBe('unavailable');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('strips the plus for the Infobip destination field', () => {
    expect(toInfobipDestination('+995555123456')).toBe('995555123456');
  });
});
