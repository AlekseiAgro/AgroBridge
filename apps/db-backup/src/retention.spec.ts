import { planRetention } from './retention';
import type { ManifestEntry } from './types';

function entry(partial: Partial<ManifestEntry> & Pick<ManifestEntry, 'id' | 'kinds' | 'createdAt'>): ManifestEntry {
  return {
    environment: 'production',
    dumpKey: `${partial.id}.dump`,
    metadataKey: `${partial.id}.json`,
    sizeBytes: 10,
    sha256: 'x',
    locked: false,
    ...partial,
  };
}

describe('planRetention', () => {
  const policy = { keepDaily: 7, keepWeekly: 4, keepMonthly: 3 };

  it('keeps the newest N of each kind and never deletes locked or manual backups', () => {
    const dailies = Array.from({ length: 9 }, (_, index) =>
      entry({
        id: `d${index}`,
        kinds: ['daily'],
        createdAt: `2026-09-${String(10 + index).padStart(2, '0')}T02:00:00.000Z`,
      }),
    );
    const weeklies = Array.from({ length: 5 }, (_, index) =>
      entry({
        id: `w${index}`,
        kinds: ['weekly'],
        createdAt: `2026-08-${String(10 + index * 7).padStart(2, '0')}T02:00:00.000Z`,
      }),
    );
    const monthlies = Array.from({ length: 4 }, (_, index) =>
      entry({
        id: `m${index}`,
        kinds: ['monthly'],
        createdAt: `2026-0${5 + index}-01T02:00:00.000Z`,
      }),
    );
    const manual = entry({
      id: 'manual-old',
      kinds: ['manual'],
      createdAt: '2026-01-01T00:00:00.000Z',
      locked: true,
    });

    const plan = planRetention([...dailies, ...weeklies, ...monthlies, manual], policy);
    const expiredIds = plan.expire.map((item) => item.id).sort();
    expect(expiredIds).toEqual(['d0', 'd1', 'm0', 'w0']);
    expect(plan.keep.map((item) => item.id)).toContain('manual-old');
    expect(plan.keep).toHaveLength(7 + 4 + 3 + 1);
  });

  it('keeps a daily dump that is also weekly even if it is older than 7 dailies', () => {
    const entries = [
      ...Array.from({ length: 8 }, (_, index) =>
        entry({
          id: `plain-${index}`,
          kinds: ['daily'],
          createdAt: `2026-09-${String(14 + index).padStart(2, '0')}T02:00:00.000Z`,
        }),
      ),
      entry({
        id: 'sunday',
        kinds: ['daily', 'weekly'],
        createdAt: '2026-09-13T02:00:00.000Z',
      }),
    ];
    const plan = planRetention(entries, policy);
    expect(plan.keep.map((item) => item.id)).toContain('sunday');
    expect(plan.expire.map((item) => item.id)).toEqual(['plain-0']);
  });
});
