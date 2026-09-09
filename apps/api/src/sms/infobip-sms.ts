import {
  SMS_INVALID_PHONE_CLIENT_MESSAGE,
  SMS_UNAVAILABLE_CLIENT_MESSAGE,
  SmsDeliveryError,
} from './sms.errors';
import { infobipSendUrl, type InfobipSmsSettings } from './sms.config';
import type { SmsMessage } from './sms.types';

type InfobipStatus = {
  groupId?: number;
  groupName?: string;
  name?: string;
  description?: string;
};

type InfobipSendResponse = {
  messages?: Array<{
    to?: string;
    status?: InfobipStatus;
  }>;
  requestError?: {
    serviceException?: {
      messageId?: string;
      text?: string;
    };
  };
};

export async function sendInfobipSms(params: {
  settings: InfobipSmsSettings;
  message: SmsMessage;
  fetchImpl: typeof fetch;
}): Promise<void> {
  const { settings, message, fetchImpl } = params;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(infobipSendUrl(settings.baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `App ${settings.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            from: settings.sender,
            destinations: [{ to: toInfobipDestination(message.to) }],
            text: message.text,
          },
        ],
      }),
      signal: controller.signal,
      redirect: 'error',
    });
  } catch (error) {
    clearTimeout(timer);
    if (isAbortError(error)) {
      throw new SmsDeliveryError('timeout', SMS_UNAVAILABLE_CLIENT_MESSAGE);
    }
    throw new SmsDeliveryError(
      'unavailable',
      SMS_UNAVAILABLE_CLIENT_MESSAGE,
    );
  } finally {
    clearTimeout(timer);
  }

  const payload = await readJson(response);

  if (response.status === 401 || response.status === 403) {
    throw new SmsDeliveryError('config', SMS_UNAVAILABLE_CLIENT_MESSAGE);
  }
  if (response.status === 400 || response.status === 422) {
    throw new SmsDeliveryError('invalid_destination', SMS_INVALID_PHONE_CLIENT_MESSAGE);
  }
  if (response.status === 429 || response.status >= 500) {
    throw new SmsDeliveryError('unavailable', SMS_UNAVAILABLE_CLIENT_MESSAGE);
  }
  if (!response.ok) {
    throw new SmsDeliveryError('unavailable', SMS_UNAVAILABLE_CLIENT_MESSAGE);
  }

  const status = payload?.messages?.[0]?.status;
  if (!status || typeof status.groupId !== 'number') {
    throw new SmsDeliveryError('unavailable', SMS_UNAVAILABLE_CLIENT_MESSAGE);
  }
  if (status.groupId === 5) {
    throw new SmsDeliveryError('rejected', SMS_INVALID_PHONE_CLIENT_MESSAGE);
  }
  if (status.groupId !== 1 && status.groupId !== 3) {
    throw new SmsDeliveryError('unavailable', SMS_UNAVAILABLE_CLIENT_MESSAGE);
  }
}

export function toInfobipDestination(e164: string): string {
  return e164.replace(/^\+/, '');
}

export function classifyInfobipFailure(error: unknown): string {
  if (error instanceof SmsDeliveryError) {
    return error.kind;
  }
  if (isAbortError(error)) {
    return 'timeout';
  }
  return 'network';
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = 'name' in error ? String(error.name) : '';
  return name === 'AbortError' || name === 'TimeoutError';
}

async function readJson(response: Response): Promise<InfobipSendResponse | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as InfobipSendResponse;
  } catch {
    throw new SmsDeliveryError('unavailable', SMS_UNAVAILABLE_CLIENT_MESSAGE);
  }
}
