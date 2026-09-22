import { redactText } from './redact';

export function logInfo(message: string): void {
  process.stdout.write(`${redactText(message)}\n`);
}

export function logError(message: string): void {
  process.stderr.write(`${redactText(message)}\n`);
}
