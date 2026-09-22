import { readFile, stat } from 'fs/promises';
import { sha256Buffer } from './metadata';
import { listCustomDump } from './dump';
import { BackupError } from './types';
import type { ChildProcess } from 'child_process';

export type VerifiedDump = {
  sizeBytes: number;
  sha256: string;
  restoreList: string;
};

export async function verifyDumpFile(params: {
  dumpPath: string;
  minBytes: number;
  track?: Set<ChildProcess>;
}): Promise<VerifiedDump> {
  let sizeBytes: number;
  try {
    const info = await stat(params.dumpPath);
    sizeBytes = info.size;
  } catch {
    throw new BackupError('file', 'Dump file does not exist');
  }

  if (sizeBytes <= 0) {
    throw new BackupError('file', 'Dump file is empty', sizeBytes);
  }
  if (sizeBytes < params.minBytes) {
    throw new BackupError(
      'min_size',
      `Dump is ${sizeBytes} bytes, below BACKUP_MIN_BYTES=${params.minBytes}`,
      sizeBytes,
    );
  }

  const contents = await readFile(params.dumpPath);
  const sha256 = sha256Buffer(contents);
  const restoreList = await listCustomDump(params.dumpPath, params.track);
  if (!restoreList.trim()) {
    throw new BackupError('pg_restore_list', 'pg_restore --list returned no TOC', sizeBytes);
  }

  return { sizeBytes, sha256, restoreList };
}
