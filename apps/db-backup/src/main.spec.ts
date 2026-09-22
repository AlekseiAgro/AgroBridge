import { main } from './main';

jest.mock('./run-backup', () => ({
  runBackup: jest.fn(),
}));

jest.mock('./alert', () => ({
  sendBackupFailureAlert: jest.fn().mockResolvedValue({ sent: false, skippedReason: 'alert_not_configured' }),
}));

const { runBackup } = jest.requireMock('./run-backup') as { runBackup: jest.Mock };
const { sendBackupFailureAlert } = jest.requireMock('./alert') as {
  sendBackupFailureAlert: jest.Mock;
};

describe('backup process exit codes', () => {
  const env = {
    DATABASE_URL: 'postgresql://agrobridge:agrobridge@127.0.0.1:5432/agrobridge_backup_test',
    BACKUP_STORAGE: 'memory',
    BACKUP_ENVIRONMENT: 'local',
  };

  beforeEach(() => {
    runBackup.mockReset();
    sendBackupFailureAlert.mockClear();
  });

  it('exits 0 after a successful run', async () => {
    runBackup.mockResolvedValue({
      dryRun: true,
      dumpKey: 'local/daily/x.dump',
      metadataKey: 'local/daily/x.json',
      sizeBytes: 10,
      sha256: 'ab',
      kinds: ['daily'],
      uploaded: false,
      expiredKeys: [],
    });
    await expect(main(env)).resolves.toBe(0);
  });

  it('exits 1 and attempts a failure alert when the run throws', async () => {
    runBackup.mockRejectedValue(new Error('pg_dump failed (exit 1): connection refused'));
    await expect(main(env)).resolves.toBe(1);
    expect(sendBackupFailureAlert).toHaveBeenCalled();
    const payload = sendBackupFailureAlert.mock.calls[0][0].payload;
    expect(payload.failedStep).toBe('pg_dump');
    expect(JSON.stringify(payload)).not.toMatch(/postgresql:\/\/agrobridge:agrobridge/);
  });

  it('exits 1 on invalid configuration', async () => {
    await expect(main({})).resolves.toBe(1);
  });
});
