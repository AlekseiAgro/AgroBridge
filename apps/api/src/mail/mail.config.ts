export type MailDriver = 'console' | 'smtp' | 'resend';

export type EnvReader = {
  get(key: string): string | undefined;
};

export type ConsoleMailSettings = {
  driver: 'console';
  from: string;
  redactBodies: boolean;
};

export type SmtpMailSettings = {
  driver: 'smtp';
  from: string;
  redactBodies: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
};

export type ResendMailSettings = {
  driver: 'resend';
  from: string;
  redactBodies: boolean;
  apiKey: string;
};

export type MailSettings = ConsoleMailSettings | SmtpMailSettings | ResendMailSettings;

export const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
export const SMTP_GREETING_TIMEOUT_MS = 10_000;
export const SMTP_SOCKET_TIMEOUT_MS = 20_000;
export const MAIL_SEND_ATTEMPTS = 3;
export const MAIL_RETRY_DELAYS_MS = [200, 800] as const;
export const SMTP_SEND_ATTEMPTS = MAIL_SEND_ATTEMPTS;
export const SMTP_RETRY_DELAYS_MS = MAIL_RETRY_DELAYS_MS;

export const MAIL_UNAVAILABLE_CLIENT_MESSAGE = 'Could not send the email. Please try again later.';

const DEFAULT_CONSOLE_FROM = 'AgroBridge <noreply@agrobridge.local>';

const TRANSIENT_SMTP_CODES = new Set([
  'ECONNECTION',
  'ETIMEDOUT',
  'ESOCKET',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETLS',
]);

const TRANSIENT_RESPONSE_CODES = new Set([421, 450, 451, 452]);

/**
 * Reads mail settings from the environment. `MAIL_DRIVER=smtp` and `MAIL_DRIVER=resend`
 * never fall back to console: missing required values fail startup with a message that
 * contains no secrets.
 */
export function resolveMailConfig(config: EnvReader): MailSettings {
  const nodeEnv = readString(config, 'NODE_ENV');
  const redactBodies = nodeEnv === 'production';
  const driver = parseDriver(readString(config, 'MAIL_DRIVER'));

  if (driver === 'console') {
    // Production must deliver mail. Staging may keep console only with an explicit override.
    if (nodeEnv === 'production' && !parseFlag(readString(config, 'MAIL_ALLOW_CONSOLE'))) {
      throw new Error(
        'MAIL_DRIVER=console is not allowed when NODE_ENV=production; set MAIL_DRIVER=resend or smtp, or MAIL_ALLOW_CONSOLE=true for staging',
      );
    }
    const from = readString(config, 'MAIL_FROM') || DEFAULT_CONSOLE_FROM;
    assertSafeFrom(from);
    return { driver, from, redactBodies };
  }

  if (driver === 'resend') {
    return resolveResendConfig(config, redactBodies);
  }

  const host = readString(config, 'SMTP_HOST');
  if (!host) {
    throw new Error('MAIL_DRIVER=smtp requires SMTP_HOST');
  }
  assertSmtpHost(host);

  const portRaw = readString(config, 'SMTP_PORT');
  if (!portRaw) {
    throw new Error('MAIL_DRIVER=smtp requires SMTP_PORT');
  }
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535');
  }

  const from = readString(config, 'MAIL_FROM');
  if (!from) {
    throw new Error('MAIL_DRIVER=smtp requires MAIL_FROM');
  }
  assertSafeFrom(from);

  const user = readString(config, 'SMTP_USER');
  const password = config.get('SMTP_PASSWORD');
  if (!user || password == null || password.trim() === '') {
    throw new Error('MAIL_DRIVER=smtp requires SMTP_USER and SMTP_PASSWORD');
  }

  return {
    driver: 'smtp',
    from,
    redactBodies,
    host,
    port,
    secure: parseSecure(readString(config, 'SMTP_SECURE'), port),
    user,
    password,
  };
}

export function describeMailConfig(settings: MailSettings): string {
  if (settings.driver === 'console') {
    return settings.redactBodies
      ? 'Mail driver: console (emails logged without bodies)'
      : 'Mail driver: console (emails logged, not sent)';
  }
  if (settings.driver === 'resend') {
    return 'Mail driver: resend';
  }
  return `Mail driver: smtp host=${settings.host} port=${settings.port} secure=${settings.secure}`;
}

export function sanitizeMailError(error: unknown, secrets: string[] = []): string {
  // Message only — stacks from nodemailer/smtp-connection can echo URLs or auth material.
  const raw = error instanceof Error ? error.message : String(error);
  let text = raw;
  for (const secret of secrets) {
    if (secret.length >= 4) {
      text = text.split(secret).join('***');
    }
  }
  text = text.replace(/\/\/[^/\s]+:[^@/\s]+@/g, '//***:***@');
  text = text.replace(/\bBearer\s+\S+/gi, 'Bearer ***');
  text = text.replace(
    /\b(pass(?:word)?|smtp_password|resend_api_key|api[_-]?key|authorization|bearer)\s*[=:]\s*\S+/gi,
    '$1=***',
  );
  text = text.replace(/([?&](?:token|code)=)[^&\s"'<>]+/gi, '$1***');
  text = text.replace(
    /\b(?:reset[_-]?token|verification[_-]?code|token)\s*[=:]\s*\S+/gi,
    (match) => `${match.split(/[=:]/, 1)[0]}=***`,
  );
  return text.replace(/\s+/g, ' ').trim().slice(0, 300);
}

export function isTransientSmtpError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = 'code' in error ? String(error.code) : '';
  if (TRANSIENT_SMTP_CODES.has(code)) {
    return true;
  }
  const responseCode = 'responseCode' in error ? Number(error.responseCode) : NaN;
  return TRANSIENT_RESPONSE_CODES.has(responseCode);
}

function resolveResendConfig(config: EnvReader, redactBodies: boolean): ResendMailSettings {
  const from = readString(config, 'MAIL_FROM');
  if (!from) {
    throw new Error('MAIL_DRIVER=resend requires MAIL_FROM');
  }
  assertSafeFrom(from);

  const apiKey = readString(config, 'RESEND_API_KEY');
  if (!apiKey) {
    throw new Error('MAIL_DRIVER=resend requires RESEND_API_KEY');
  }

  return { driver: 'resend', from, redactBodies, apiKey };
}

function parseDriver(raw: string): MailDriver {
  if (!raw) {
    return 'console';
  }
  const normalized = raw.toLowerCase();
  if (normalized === 'console' || normalized === 'smtp' || normalized === 'resend') {
    return normalized;
  }
  throw new Error('MAIL_DRIVER must be console, smtp, or resend');
}

function parseFlag(raw: string): boolean {
  const normalized = raw.toLowerCase();
  return normalized === 'true' || normalized === '1';
}

function parseSecure(raw: string, port: number): boolean {
  if (!raw) {
    return port === 465;
  }
  const normalized = raw.toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }
  throw new Error('SMTP_SECURE must be true or false');
}

function assertSmtpHost(host: string): void {
  if (host.includes('://') || host.includes('@') || /\s/.test(host)) {
    throw new Error('SMTP_HOST must be a hostname, not a URL');
  }
}

function assertSafeFrom(from: string): void {
  if (/[\r\n]/.test(from)) {
    throw new Error('MAIL_FROM must not contain line breaks');
  }
  const email = /<([^>]+)>/.exec(from)?.[1] ?? from;
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 254) {
    throw new Error('MAIL_FROM must be a valid email address');
  }
}

function readString(config: EnvReader, key: string): string {
  return config.get(key)?.trim() ?? '';
}
