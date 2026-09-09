import {
  SMS_INVALID_PHONE_CLIENT_MESSAGE,
  SMS_UNAVAILABLE_CLIENT_MESSAGE,
  SmsDeliveryError,
  type SmsDeliveryKind,
} from './sms.errors';
import { infobipSendUrl, type InfobipSmsSettings } from './sms.config';
import type { SmsMessage } from './sms.types';

type InfobipStatus = {
  groupId?: number;
  groupName?: string;
  id?: number;
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

/**
 * Infobip statuses that mean the destination itself is unusable.
 * Broader REJECTED (groupId 5) must not be treated as an invalid phone:
 * sender, network, DND, and unknown rejections are generic SMS failures.
 */
const DESTINATION_STATUS_NAMES = new Set([
  'REJECTED_PREFIX_MISSING',
  'REJECTED_DESTINATION',
]);

const DESTINATION_EXCEPTION_IDS = new Set([
  'REJECTED_PREFIX_MISSING',
  'REJECTED_DESTINATION',
  'INVALID_DESTINATION_ADDRESS',
  'EC_INVALID_DESTINATION_ADDRESS',
]);

export function normalizeInfobipErrorCode(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

export function isDestinationSpecificInfobipFailure(input: {
  statusName?: string;
  exceptionMessageId?: string;
}): boolean {
  const statusName = normalizeInfobipErrorCode(input.statusName);
  const exceptionId = normalizeInfobipErrorCode(input.exceptionMessageId);
  return (
    DESTINATION_STATUS_NAMES.has(statusName) ||
    DESTINATION_EXCEPTION_IDS.has(exceptionId)
  );
}

function clientMessageFor(kind: SmsDeliveryKind): string {
  return kind === 'invalid_destination'
    ? SMS_INVALID_PHONE_CLIENT_MESSAGE
    : SMS_UNAVAILABLE_CLIENT_MESSAGE;
}

function throwSmsError(kind: SmsDeliveryKind): never {
  throw new SmsDeliveryError(kind, clientMessageFor(kind));
}

export function classifyInfobipHttpFailure(
  httpStatus: number,
  body: InfobipSendResponse | null | undefined,
): SmsDeliveryKind {
  const exceptionId = body?.requestError?.serviceException?.messageId;
  const statusName = body?.messages?.[0]?.status?.name;
  const destinationSpecific = isDestinationSpecificInfobipFailure({
    statusName,
    exceptionMessageId: exceptionId,
  });

  if (httpStatus === 401 || httpStatus === 403) {
    return 'config';
  }

  if (httpStatus === 400 || httpStatus === 422) {
    return destinationSpecific ? 'invalid_destination' : 'unavailable';
  }

  return 'unavailable';
}

export function classifyInfobipAcceptedMessage(
  status: InfobipStatus | undefined,
): SmsDeliveryKind | 'ok' {
  if (!status || typeof status.groupId !== 'number') {
    return 'unavailable';
  }

  if (status.groupId === 1 || status.groupId === 3) {
    return 'ok';
  }

  if (isDestinationSpecificInfobipFailure({ statusName: status.name })) {
    return 'invalid_destination';
  }

  return 'unavailable';
}

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
    throw new SmsDeliveryError('unavailable', SMS_UNAVAILABLE_CLIENT_MESSAGE);
  } finally {
    clearTimeout(timer);
  }

  const payload = await readJson(response);

  if (!response.ok) {
    throwSmsError(classifyInfobipHttpFailure(response.status, payload));
  }

  const classified = classifyInfobipAcceptedMessage(payload?.messages?.[0]?.status);
  if (classified !== 'ok') {
    throwSmsError(classified);
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
