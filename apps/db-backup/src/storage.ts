import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import type { BackupObjectStore, ObjectHead } from './types';
import { BackupError } from './types';

function assertSafeKey(key: string): string {
  if (!key || key.startsWith('/') || key.includes('..') || key.includes('\\')) {
    throw new BackupError('upload', 'Refusing unsafe object key');
  }
  return key;
}

export class MemoryBackupStore implements BackupObjectStore {
  readonly objects = new Map<string, Buffer>();
  readonly operations: string[] = [];

  async putObject(key: string, body: Buffer, _contentType: string): Promise<void> {
    const safe = assertSafeKey(key);
    this.operations.push(`put:${safe}`);
    this.objects.set(safe, Buffer.from(body));
  }

  async headObject(key: string): Promise<ObjectHead | null> {
    const body = this.objects.get(assertSafeKey(key));
    return body ? { key, sizeBytes: body.length } : null;
  }

  async getObject(key: string): Promise<Buffer | null> {
    const body = this.objects.get(assertSafeKey(key));
    return body ? Buffer.from(body) : null;
  }

  async deleteObject(key: string): Promise<void> {
    const safe = assertSafeKey(key);
    this.operations.push(`delete:${safe}`);
    this.objects.delete(safe);
  }
}

export class FilesystemBackupStore implements BackupObjectStore {
  constructor(private readonly root: string) {}

  private resolveKey(key: string): string {
    const safe = assertSafeKey(key);
    const absolute = resolve(this.root, safe);
    const root = resolve(this.root);
    if (absolute !== root && !absolute.startsWith(root + '/')) {
      throw new BackupError('upload', 'Object key escaped storage root');
    }
    return absolute;
  }

  async putObject(key: string, body: Buffer, _contentType: string): Promise<void> {
    const path = this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, { mode: 0o600 });
  }

  async headObject(key: string): Promise<ObjectHead | null> {
    try {
      const info = await stat(this.resolveKey(key));
      return { key, sizeBytes: info.size };
    } catch {
      return null;
    }
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolveKey(key));
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await unlink(this.resolveKey(key));
    } catch {
      // Already gone.
    }
  }
}

export class DryRunStore implements BackupObjectStore {
  readonly plannedPuts: string[] = [];
  readonly plannedDeletes: string[] = [];

  constructor(private readonly inner?: BackupObjectStore) {}

  async putObject(key: string, _body: Buffer, _contentType: string): Promise<void> {
    this.plannedPuts.push(assertSafeKey(key));
  }

  async headObject(key: string): Promise<ObjectHead | null> {
    return this.inner ? this.inner.headObject(key) : null;
  }

  async getObject(key: string): Promise<Buffer | null> {
    return this.inner ? this.inner.getObject(key) : null;
  }

  async deleteObject(key: string): Promise<void> {
    this.plannedDeletes.push(assertSafeKey(key));
  }
}

export function joinStorePath(root: string, key: string): string {
  return join(root, key);
}
