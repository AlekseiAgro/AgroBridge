import {
  SMS_INVALID_PHONE_CLIENT_MESSAGE,
  SMS_UNAVAILABLE_CLIENT_MESSAGE,
  SmsDeliveryError,
} from './sms.errors';
import {
  classifyInfobipAcceptedMessage,
  classifyInfobipHttpFailure,
  isDestinationSpecificInfobipFailure,
  sendInfobipSms,
  toInfobipDestination,
} from './infobip-sms';
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

function expectSafeClientError(
  error: unknown,
  kind: SmsDeliveryError['kind'],
  clientMessage: string,
) {
  expect(error).toBeInstanceOf(SmsDeliveryError);
  const delivery = error as SmsDeliveryError;
  expect(delivery.kind).toBe(kind);
  expect(delivery.message).toBe(clientMessage);
  expect(delivery.clientMessage).toBe(clientMessage);
  expect(delivery.message).not.toContain('test-infobip-key-value');
  expect(delivery.message).not.toContain('Authorization');
  expect(delivery.message).not.toContain('App ');
  expect(delivery.message).not.toContain('123456');
}

describe('Infobip error classification', () => {
  it('treats prefix-missing and destination rejections as destination-specific', () => {
    expect(
      isDestinationSpecificInfobipFailure({ statusName: 'REJECTED_PREFIX_MISSING' }),
    ).toBe(true);
    expect(
      isDestinationSpecificInfobipFailure({ statusName: 'REJECTED_DESTINATION' }),
    ).toBe(true);
    expect(
      isDestinationSpecificInfobipFailure({
        exceptionMessageId: 'EC_INVALID_DESTINATION_ADDRESS',
      }),
    ).toBe(true);
  });

  it('does not treat sender, network, DND, or account destination variants as invalid phones', () => {
    expect(
      isDestinationSpecificInfobipFailure({ statusName: 'REJECTED_SOURCE' }),
    ).toBe(false);
    expect(
      isDestinationSpecificInfobipFailure({ statusName: 'REJECTED_NETWORK' }),
    ).toBe(false);
    expect(isDestinationSpecificInfobipFailure({ statusName: 'REJECTED_DND' })).toBe(
      false,
    );
    expect(
      isDestinationSpecificInfobipFailure({
        statusName: 'REJECTED_DESTINATION_NOT_REGISTERED',
      }),
    ).toBe(false);
    expect(
      isDestinationSpecificInfobipFailure({
        statusName: 'REJECTED_DESTINATION_BLOCKLISTED',
      }),
    ).toBe(false);
    expect(isDestinationSpecificInfobipFailure({ statusName: undefined })).toBe(false);
  });

  it('maps HTTP 400/422 to invalid phone only when the provider names a destination error', () => {
    expect(classifyInfobipHttpFailure(400, { requestError: { serviceException: { messageId: 'BAD_REQUEST', text: 'Malformed JSON' } } })).toBe(
      'unavailable',
    );
    expect(
      classifyInfobipHttpFailure(422, {
        requestError: {
          serviceException: { messageId: 'REJECTED_DESTINATION', text: 'bad to' },
        },
      }),
    ).toBe('invalid_destination');
  });

  it('maps accepted PENDING/DELIVERED groups to success and other REJECTED names to generic failure', () => {
    expect(classifyInfobipAcceptedMessage({ groupId: 1, groupName: 'PENDING' })).toBe(
      'ok',
    );
    expect(
      classifyInfobipAcceptedMessage({
        groupId: 5,
        groupName: 'REJECTED',
        name: 'REJECTED_PREFIX_MISSING',
      }),
    ).toBe('invalid_destination');
    expect(
      classifyInfobipAcceptedMessage({
        groupId: 5,
        groupName: 'REJECTED',
        name: 'REJECTED_SOURCE',
      }),
    ).toBe('unavailable');
    expect(
      classifyInfobipAcceptedMessage({ groupId: 5, groupName: 'REJECTED' }),
    ).toBe('unavailable');
  });
});

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

  it('keeps an existing successful PENDING response successful', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, accepted));
    await expect(
      sendInfobipSms({
        settings,
        message: { to: '+995555123456', text: 'AgroBridge verification code: 123456' },
        fetchImpl,
      }),
    ).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps destination rejection to an invalid-phone client error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        messages: [
          {
            status: {
              groupId: 5,
              groupName: 'REJECTED',
              name: 'REJECTED_DESTINATION',
              description: 'Destination address is not valid',
            },
          },
        ],
      }),
    );

    const error = await sendInfobipSms({
      settings,
      message: { to: '+995555123456', text: 'code 123456' },
      fetchImpl,
    }).catch((err: unknown) => err);

    expectSafeClientError(error, 'invalid_destination', SMS_INVALID_PHONE_CLIENT_MESSAGE);
    expect((error as Error).message).not.toContain('Destination address is not valid');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps prefix-missing rejection to an invalid-phone client error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        messages: [
          {
            status: {
              groupId: 5,
              groupName: 'REJECTED',
              name: 'REJECTED_PREFIX_MISSING',
            },
          },
        ],
      }),
    );

    const error = await sendInfobipSms({
      settings,
      message: { to: '+995555123456', text: 'code 123456' },
      fetchImpl,
    }).catch((err: unknown) => err);

    expectSafeClientError(error, 'invalid_destination', SMS_INVALID_PHONE_CLIENT_MESSAGE);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps sender rejection to generic unavailable', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        messages: [
          {
            status: {
              groupId: 5,
              groupName: 'REJECTED',
              name: 'REJECTED_SOURCE',
              description: 'Sender is not allowed',
            },
          },
        ],
      }),
    );

    const error = await sendInfobipSms({
      settings,
      message: { to: '+995555123456', text: 'code 123456' },
      fetchImpl,
    }).catch((err: unknown) => err);

    expectSafeClientError(error, 'unavailable', SMS_UNAVAILABLE_CLIENT_MESSAGE);
    expect((error as Error).message).not.toContain('Sender is not allowed');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps network rejection to generic unavailable', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        messages: [
          {
            status: {
              groupId: 5,
              groupName: 'REJECTED',
              name: 'REJECTED_NETWORK',
            },
          },
        ],
      }),
    );

    const error = await sendInfobipSms({
      settings,
      message: { to: '+995555123456', text: 'code 123456' },
      fetchImpl,
    }).catch((err: unknown) => err);

    expectSafeClientError(error, 'unavailable', SMS_UNAVAILABLE_CLIENT_MESSAGE);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps DND rejection to generic unavailable', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        messages: [
          {
            status: {
              groupId: 5,
              groupName: 'REJECTED',
              name: 'REJECTED_DND',
            },
          },
        ],
      }),
    );

    const error = await sendInfobipSms({
      settings,
      message: { to: '+995555123456', text: 'code 123456' },
      fetchImpl,
    }).catch((err: unknown) => err);

    expectSafeClientError(error, 'unavailable', SMS_UNAVAILABLE_CLIENT_MESSAGE);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps unknown REJECTED status to generic unavailable', async () => {
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

    expectSafeClientError(error, 'unavailable', SMS_UNAVAILABLE_CLIENT_MESSAGE);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps HTTP 400 unrelated to destination to generic unavailable without leaking the key', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(400, {
        requestError: {
          serviceException: {
            messageId: 'BAD_REQUEST',
            text: 'Request body is not valid JSON; Authorization App test-infobip-key-value',
          },
        },
      }),
    );

    const error = await sendInfobipSms({
      settings,
      message: { to: '+995555123456', text: 'code 123456' },
      fetchImpl,
    }).catch((err: unknown) => err);

    expectSafeClientError(error, 'unavailable', SMS_UNAVAILABLE_CLIENT_MESSAGE);
    expect((error as Error).message).not.toContain('Request body is not valid JSON');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps HTTP 400 destination exceptions to an invalid-phone client error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(400, {
        requestError: {
          serviceException: {
            messageId: 'EC_INVALID_DESTINATION_ADDRESS',
            text: 'Invalid destination address',
          },
        },
      }),
    );

    const error = await sendInfobipSms({
      settings,
      message: { to: '+995555123456', text: 'code 123456' },
      fetchImpl,
    }).catch((err: unknown) => err);

    expectSafeClientError(error, 'invalid_destination', SMS_INVALID_PHONE_CLIENT_MESSAGE);
    expect((error as Error).message).not.toContain('Invalid destination address');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps provider HTTP 500 to unavailable', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(500, { error: 'down' }));
    const error = await sendInfobipSms({
      settings,
      message: { to: '+995555123456', text: 'code 123456' },
      fetchImpl,
    }).catch((err: unknown) => err);
    expectSafeClientError(error, 'unavailable', SMS_UNAVAILABLE_CLIENT_MESSAGE);
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
    expectSafeClientError(error, 'unavailable', SMS_UNAVAILABLE_CLIENT_MESSAGE);
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

    expectSafeClientError(error, 'timeout', SMS_UNAVAILABLE_CLIENT_MESSAGE);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps a network failure to unavailable without a second request', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    const error = await sendInfobipSms({
      settings,
      message: { to: '+995555123456', text: 'code 123456' },
      fetchImpl,
    }).catch((err: unknown) => err);
    expectSafeClientError(error, 'unavailable', SMS_UNAVAILABLE_CLIENT_MESSAGE);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('strips the plus for the Infobip destination field', () => {
    expect(toInfobipDestination('+995555123456')).toBe('995555123456');
  });
});
