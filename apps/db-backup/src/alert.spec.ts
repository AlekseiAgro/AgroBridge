import { buildBackupFailureAlert, sendBackupFailureAlert } from './alert';

describe('backup failure alerts', () => {
  const payload = {
    createdAt: '2026-09-22T02:00:00.000Z',
    environment: 'production',
    failedStep: 'pg_dump' as const,
    message: 'pg_dump failed (exit 1): connection refused',
    sizeBytes: 0,
  };

  it('builds a safe message without secrets or SQL', () => {
    const alert = buildBackupFailureAlert(payload);
    expect(alert.subject).toBe('AgroBridge PostgreSQL backup failed');
    expect(alert.text).toContain('step: pg_dump');
    expect(alert.text).toContain('sizeBytes: 0');
    expect(alert.text).not.toMatch(/postgresql:\/\/|PASSWORD|AKIA|SELECT /i);
  });

  it('does not send in dry-run and records a preview', async () => {
    const result = await sendBackupFailureAlert({
      config: {
        resendApiKey: 're_test',
        email: 'ops@example.com',
        mailFrom: 'AgroBridge <no-reply@example.com>',
      },
      payload,
      dryRun: true,
      fetchImpl: jest.fn(),
    });
    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe('dry_run');
    expect(result.preview?.to).toBe('ops@example.com');
  });

  it('posts to Resend only when configured', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const result = await sendBackupFailureAlert({
      config: {
        resendApiKey: 're_test',
        email: 'ops@example.com',
        mailFrom: 'AgroBridge <no-reply@example.com>',
      },
      payload,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.sent).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchImpl.mock.calls[0][1].body));
    expect(body.subject).toContain('backup failed');
    expect(JSON.stringify(body)).not.toMatch(/postgresql:\/\//);
  });
});
