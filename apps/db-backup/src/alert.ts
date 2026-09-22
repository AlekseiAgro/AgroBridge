import type { BackupFailurePayload } from './types';

export const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

export type AlertConfig = {
  resendApiKey?: string;
  email?: string;
  mailFrom?: string;
};

export type BuiltBackupAlert = {
  to: string;
  from: string;
  subject: string;
  text: string;
};

export function buildBackupFailureAlert(payload: BackupFailurePayload): {
  subject: string;
  text: string;
} {
  const lines = [
    'AgroBridge PostgreSQL backup failed.',
    '',
    `time: ${payload.createdAt}`,
    `environment: ${payload.environment}`,
    `step: ${payload.failedStep}`,
    `error: ${payload.message}`,
  ];
  if (typeof payload.sizeBytes === 'number') {
    lines.push(`sizeBytes: ${payload.sizeBytes}`);
  }
  lines.push('', 'No connection strings, credentials, or application data are included.');
  return {
    subject: 'AgroBridge PostgreSQL backup failed',
    text: lines.join('\n'),
  };
}

export function prepareBackupFailureAlert(
  config: AlertConfig,
  payload: BackupFailurePayload,
): BuiltBackupAlert {
  if (!config.email || !config.mailFrom) {
    throw new Error('BACKUP_ALERT_EMAIL and MAIL_FROM are required to send a failure alert');
  }
  const built = buildBackupFailureAlert(payload);
  return {
    to: config.email,
    from: config.mailFrom,
    subject: built.subject,
    text: built.text,
  };
}

export async function sendBackupFailureAlert(params: {
  config: AlertConfig;
  payload: BackupFailurePayload;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<{ sent: boolean; skippedReason?: string; preview?: BuiltBackupAlert }> {
  if (!params.config.email || !params.config.mailFrom) {
    return { sent: false, skippedReason: 'alert_not_configured' };
  }

  const preview = prepareBackupFailureAlert(params.config, params.payload);
  if (params.dryRun) {
    return { sent: false, skippedReason: 'dry_run', preview };
  }
  if (!params.config.resendApiKey) {
    return { sent: false, skippedReason: 'missing_resend_api_key', preview };
  }

  const fetchImpl = params.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const response = await fetchImpl(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: preview.from,
      to: preview.to,
      subject: preview.subject,
      text: preview.text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend rejected the failure alert (HTTP ${response.status})`);
  }

  return { sent: true, preview };
}
