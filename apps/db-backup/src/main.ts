import type { ChildProcess } from 'child_process';
import { loadBackupConfig } from './config';
import { sendBackupFailureAlert } from './alert';
import { killTracked } from './process';
import { runBackup } from './run-backup';
import { BackupError, type BackupFailureStep } from './types';
import { logError, logInfo } from './logger';
import { redactError } from './redact';

export async function main(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const tracked = new Set<ChildProcess>();
  let timeout: NodeJS.Timeout | undefined;
  let timedOut = false;

  const fail = async (
    step: BackupFailureStep,
    message: string,
    sizeBytes?: number,
    config?: ReturnType<typeof loadBackupConfig>,
  ): Promise<number> => {
    logError(`backup failed at ${step}: ${message}`);
    if (config) {
      try {
        const alert = await sendBackupFailureAlert({
          config: config.alert,
          payload: {
            createdAt: new Date().toISOString(),
            environment: config.environment,
            failedStep: step,
            message,
            sizeBytes,
          },
          dryRun: config.dryRun,
        });
        if (alert.sent) {
          logInfo('failure alert sent');
        } else if (alert.skippedReason && alert.skippedReason !== 'dry_run') {
          logInfo(`failure alert skipped (${alert.skippedReason})`);
        }
      } catch (error) {
        logError(`failure alert could not be sent: ${redactError(error)}`);
      }
    }
    return 1;
  };

  let config: ReturnType<typeof loadBackupConfig> | undefined;
  try {
    config = loadBackupConfig(env);
  } catch (error) {
    const step = error instanceof BackupError ? error.step : 'config';
    return fail(step, redactError(error));
  }

  timeout = setTimeout(() => {
    timedOut = true;
    killTracked(tracked);
  }, config.timeoutMs);

  try {
    const result = await runBackup({ config, track: tracked });
    if (timedOut) {
      return fail('timeout', `Backup exceeded BACKUP_TIMEOUT_MS=${config.timeoutMs}`, result.sizeBytes, config);
    }
    logInfo(result.dryRun ? 'backup dry-run completed' : 'backup completed');
    return 0;
  } catch (error) {
    if (timedOut) {
      return fail('timeout', `Backup exceeded BACKUP_TIMEOUT_MS=${config.timeoutMs}`, undefined, config);
    }
    const step = error instanceof BackupError ? error.step : 'pg_dump';
    const sizeBytes = error instanceof BackupError ? error.sizeBytes : undefined;
    return fail(step, redactError(error), sizeBytes, config);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
    killTracked(tracked);
  }
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((error: unknown) => {
      logError(redactError(error));
      process.exit(1);
    });
}
