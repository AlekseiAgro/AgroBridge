import { mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { sha256Buffer } from './metadata';
import { verifyDumpFile } from './verify';

jest.mock('./dump', () => ({
  listCustomDump: jest.fn(async () => '; Archive TOC:\n123; DATABASE agrobridge'),
}));

describe('verifyDumpFile', () => {
  it('rejects missing, empty, and undersized dumps', async () => {
    await expect(
      verifyDumpFile({ dumpPath: join(tmpdir(), 'missing-agrobridge.dump'), minBytes: 10 }),
    ).rejects.toThrow(/does not exist/);

    const dir = await mkdtemp(join(tmpdir(), 'agrobridge-verify-'));
    const empty = join(dir, 'empty.dump');
    await writeFile(empty, Buffer.alloc(0));
    await expect(verifyDumpFile({ dumpPath: empty, minBytes: 10 })).rejects.toThrow(/empty/);

    const tiny = join(dir, 'tiny.dump');
    await writeFile(tiny, Buffer.from('abc'));
    await expect(verifyDumpFile({ dumpPath: tiny, minBytes: 10 })).rejects.toThrow(/BACKUP_MIN_BYTES/);
  });

  it('accepts a dump that meets the size floor and returns a checksum', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agrobridge-verify-'));
    const path = join(dir, 'ok.dump');
    const contents = Buffer.from('custom-format-placeholder-dump');
    await writeFile(path, contents);
    const verified = await verifyDumpFile({ dumpPath: path, minBytes: 10 });
    expect(verified.sizeBytes).toBe(contents.length);
    expect(verified.sha256).toBe(sha256Buffer(contents));
    expect(verified.restoreList).toContain('TOC');
  });
});
