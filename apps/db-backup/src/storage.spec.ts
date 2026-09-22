import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FilesystemBackupStore } from './storage';

describe('FilesystemBackupStore', () => {
  it('rejects path traversal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agrobridge-store-'));
    const store = new FilesystemBackupStore(root);
    await expect(store.putObject('../escape.dump', Buffer.from('x'), 'application/octet-stream')).rejects.toThrow(
      /unsafe object key/,
    );
  });
});
