import {
  SMS_INVALID_PHONE_CLIENT_MESSAGE,
  SMS_UNAVAILABLE_CLIENT_MESSAGE,
} from './sms.errors';

export type SmsDriver = 'console' | 'infobip';

export type EnvReader = {
  get(key: string): string | undefined;
};

export type ConsoleSmsSettings = {
  driver: 'console';
  redactBodies: boolean;
};

export type InfobipSmsSettings = {
  driver: 'infobip';
  redactBodies: boolean;
  apiKey: string;
  baseUrl: string;
  sender: string;
  timeoutMs: number;
};

export type SmsSettings = ConsoleSmsSettings | InfobipSmsSettings;

export const SMS_REQUEST_TIMEOUT_MS = 12_000;
export const INFOBIP_SMS_PATH = '/sms/2/text/advanced';

/**
 * Reads SMS settings from the environment. `SMS_DRIVER=infobip` never falls back
 * to console: missing values fail startup with a message that contains no secrets.
 */
export function resolveSmsConfig(config: EnvReader): SmsSettings {
  const nodeEnv = readString(config, 'NODE_ENV');
  const redactBodies = nodeEnv === 'production';
  const driver = parseDriver(readString(config, 'SMS_DRIVER'));

  if (driver === 'console') {
    if (nodeEnv === 'production' && !parseFlag(readString(config, 'SMS_ALLOW_CONSOLE'))) {
      throw new Error(
        'SMS_DRIVER=console is not allowed when NODE_ENV=production; set SMS_DRIVER=infobip, or SMS_ALLOW_CONSOLE=true for staging',
      );
    }
    return { driver, redactBodies };
  }

  const apiKey = readString(config, 'INFOBIP_API_KEY');
  if (!apiKey) {
    throw new Error('SMS_DRIVER=infobip requires INFOBIP_API_KEY');
  }

  const baseUrl = assertInfobipBaseUrl(readString(config, 'INFOBIP_BASE_URL'));
  const sender = assertSender(readString(config, 'INFOBIP_SENDER'));

  return {
    driver: 'infobip',
    redactBodies,
    apiKey,
    baseUrl,
    sender,
    timeoutMs: SMS_REQUEST_TIMEOUT_MS,
  };
}

export function describeSmsConfig(settings: SmsSettings): string {
  if (settings.driver === 'console') {
    return settings.redactBodies
      ? 'SMS driver: console (messages logged without bodies)'
      : 'SMS driver: console (messages logged, not sent)';
  }
  const host = new URL(settings.baseUrl).hostname;
  return `SMS driver: infobip host=${host}`;
}

export function sanitizeSmsError(error: unknown, secrets: string[] = []): string {
  const raw = error instanceof Error ? error.message : String(error);
  let text = raw;
  for (const secret of secrets) {
    if (secret.length >= 4) {
      text = text.split(secret).join('***');
    }
  }
  text = text.replace(/\bApp\s+\S+/gi, 'App ***');
  text = text.replace(
    /\b(api[_-]?key|authorization|bearer|infobip_api_key|password)\s*[=:]\s*\S+/gi,
    '$1=***',
  );
  text = text.replace(/\/\/[^/\s]+:[^@/\s]+@/g, '//***:***@');
  return text.replace(/\s+/g, ' ').trim().slice(0, 300);
}

export function infobipSendUrl(baseUrl: string): string {
  return `${baseUrl}${INFOBIP_SMS_PATH}`;
}

function parseDriver(raw: string): SmsDriver {
  if (!raw) {
    return 'console';
  }
  const normalized = raw.toLowerCase();
  if (normalized === 'console' || normalized === 'infobip') {
    return normalized;
  }
  throw new Error('SMS_DRIVER must be console or infobip');
}

function parseFlag(raw: string): boolean {
  const normalized = raw.toLowerCase();
  return normalized === 'true' || normalized === '1';
}

function assertInfobipBaseUrl(raw: string): string {
  if (!raw) {
    throw new Error('SMS_DRIVER=infobip requires INFOBIP_BASE_URL');
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('INFOBIP_BASE_URL must be a valid HTTPS URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('INFOBIP_BASE_URL must use HTTPS');
  }
  if (parsed.username || parsed.password) {
    throw new Error('INFOBIP_BASE_URL must not include credentials');
  }
  if (parsed.port && parsed.port !== '443') {
    throw new Error('INFOBIP_BASE_URL must not include a custom port');
  }
  if (!/^(?:[a-z0-9-]+\.)?api\.infobip\.com$/i.test(parsed.hostname)) {
    throw new Error('INFOBIP_BASE_URL host must be api.infobip.com or *.api.infobip.com');
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error('INFOBIP_BASE_URL must not include a path');
  }
  if (parsed.search || parsed.hash) {
    throw new Error('INFOBIP_BASE_URL must not include a query or fragment');
  }
  return `https://${parsed.hostname.toLowerCase()}`;
}

function assertSender(raw: string): string {
  if (!raw) {
    throw new Error('SMS_DRIVER=infobip requires INFOBIP_SENDER');
  }
  if (/[\r\n]/.test(raw)) {
    throw new Error('INFOBIP_SENDER must not contain line breaks');
  }
  if (raw.length > 16) {
    throw new Error('INFOBIP_SENDER is too long');
  }
  if (!/^[A-Za-z0-9]+$/.test(raw)) {
    throw new Error('INFOBIP_SENDER must be alphanumeric');
  }
  return raw;
}

function readString(config: EnvReader, key: string): string {
  return config.get(key)?.trim() ?? '';
}

export { SMS_INVALID_PHONE_CLIENT_MESSAGE, SMS_UNAVAILABLE_CLIENT_MESSAGE };
