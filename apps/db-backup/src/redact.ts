const URL_WITH_PASSWORD = /([a-z][a-z0-9+.-]*):\/\/([^:/?#]+):([^@/?#]*)@/gi;
const POSTGRES_URL = /postgres(?:ql)?:\/\/[^\s"'`]+/gi;
const AWS_ACCESS_KEY = /(?<![A-Z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Z0-9])/g;
const HEX_SECRET = /(?<![A-Fa-f0-9])[A-Fa-f0-9]{32,}(?![A-Fa-f0-9])/g;

export function redactText(value: string): string {
  return value
    .replace(URL_WITH_PASSWORD, '$1://$2:***@')
    .replace(POSTGRES_URL, '[redacted-database-url]')
    .replace(AWS_ACCESS_KEY, '[redacted-access-key]')
    .replace(HEX_SECRET, '[redacted]');
}

export function redactError(error: unknown): string {
  if (error instanceof Error) {
    return redactText(error.message.split('\n')[0] ?? 'unknown error');
  }
  return redactText(String(error));
}

export function assertSafeLogValue(value: string): void {
  if (/postgres(?:ql)?:\/\//i.test(value) || /:[^/@]+@/.test(value)) {
    throw new Error('Refusing to log a value that looks like a connection string');
  }
}
