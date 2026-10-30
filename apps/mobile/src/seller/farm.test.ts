import { ApiClient } from '../api/client';
import { ApiError } from '../api/errors';
import type { DraftGate } from './draft';
import {
  approvedPrimaryDocumentLocked,
  farmDocumentDownloadUrl,
  farmDocumentFilePath,
  farmDocumentIssue,
  farmFieldIssue,
  farmPhotoIssue,
  farmSaveTouchesMedia,
  farmWriteBody,
  FARM_DOCUMENT_MAX_BYTES,
  FARM_DOCUMENT_MAX_COUNT,
  FARM_PHOTO_MAX_BYTES,
  FARM_PHOTO_MAX_COUNT,
  fillFarmDocumentForm,
  fillFarmPhotoForm,
  identityUploadSubmitsReview,
  parseFarmProfile,
  parseFarmVerification,
  resolveFarmDocumentMime,
  resolveFarmPhotoMime,
  submitFarmDocumentDelete,
  submitFarmDocumentUpload,
  submitFarmPhotoDelete,
  submitFarmPhotoPrimary,
  submitFarmPhotoUpload,
  submitFarmSave,
  verificationSectionState,
} from './farm';
import { uploadFarmDocument } from './farm-api';

const gate = (): DraftGate => ({ pending: false });

async function asReactNative<T>(run: () => Promise<T>): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { product: 'ReactNative' }, configurable: true });
  try {
    return await run();
  } finally {
    if (original) {
      Object.defineProperty(globalThis, 'navigator', original);
    } else {
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  }
}

const file = {
  uri: 'file:///id.pdf',
  name: 'id.pdf',
  mimeType: 'application/pdf',
  fileSize: 1000,
};

const photo = {
  uri: 'file:///farm.jpg',
  name: 'farm.jpg',
  mimeType: 'image/jpeg',
  fileSize: 1000,
};

const farmBody = {
  id: 'farm-1',
  name: 'Kakheti Orchard',
  region: 'kakheti',
  description: 'Apples',
  foundedYear: 1998,
  farmSizeHectares: 12.5,
  producerType: 'family',
  ownershipType: null,
  exportMarkets: ['Germany'],
  history: 'Started in 1998',
  verificationStatus: 'unverified',
  photos: [{ id: 'p1', url: 'https://cdn.example/p1.jpg', sortOrder: 0, isPrimary: true }],
  documents: [
    {
      id: 'd1',
      title: 'ID',
      fileName: 'id.pdf',
      kind: 'idCard',
      reviewStatus: 'pending',
      reviewNote: null,
    },
  ],
};

describe('farm profile', () => {
  it('parses the owner farm and treats a missing farm as empty', () => {
    expect(parseFarmProfile(null)).toBeNull();
    expect(parseFarmProfile(farmBody)?.name).toBe('Kakheti Orchard');
    expect(parseFarmProfile(farmBody)?.documents[0]?.kind).toBe('idCard');
  });

  it('creates and updates without media or product ids', async () => {
    const values = {
      name: 'Kakheti Orchard',
      region: 'kakheti',
      description: 'Apples',
      foundedYear: '1998',
      farmSizeHectares: '12,5',
      producerType: 'family' as const,
      exportMarkets: 'Germany, Germany',
      history: 'Started',
    };
    const body = farmWriteBody(values);
    expect(body.farmSizeHectares).toBe(12.5);
    expect(body.exportMarkets).toEqual(['Germany']);
    expect(farmSaveTouchesMedia(body)).toBe(false);
    expect(body).not.toHaveProperty('productIds');

    const calls: string[] = [];
    const created = await submitFarmSave({
      mode: 'create',
      values,
      gate: gate(),
      save: async (next) => {
        calls.push(next.name);
        return farmBody;
      },
      onPending: () => undefined,
    });
    expect(created.status).toBe('saved');

    const pending: DraftGate = { pending: true };
    expect(
      (
        await submitFarmSave({
          mode: 'edit',
          values,
          gate: pending,
          save: async () => farmBody,
          onPending: () => undefined,
        })
      ).status,
    ).toBe('ignored');
  });

  it('rejects invalid profile fields and API failures', async () => {
    expect(farmFieldIssue({ ...farmWriteValues(), name: 'A' })).toBe('nameRequired');
    expect(farmFieldIssue({ ...farmWriteValues(), foundedYear: '1700' })).toBe('yearInvalid');
    const failed = await submitFarmSave({
      mode: 'create',
      values: farmWriteValues(),
      gate: gate(),
      save: async () => {
        throw new ApiError({ message: 'Farm profile already exists', status: 409, kind: 'http' });
      },
      onPending: () => undefined,
    });
    expect(failed).toEqual({ status: 'failed', failure: 'conflict' });
  });
});

describe('farm photos', () => {
  it('enforces the farm photo limit and does not patch the profile', async () => {
    expect(FARM_PHOTO_MAX_COUNT).toBe(3);
    expect(farmPhotoIssue({ ...photo, fileSize: FARM_PHOTO_MAX_BYTES + 1 }, 0)).toBe('tooLarge');
    expect(farmPhotoIssue({ ...photo, mimeType: 'image/gif' }, 0)).toBe('unsupported');
    expect(farmPhotoIssue(photo, 3)).toBe('maxReached');
    const form = new FormData();
    fillFarmPhotoForm(form, photo, false);
    expect(form.get('file')).toBeTruthy();
    expect(form.get('kind')).toBeNull();

    let patched = false;
    const uploaded = await submitFarmPhotoUpload({
      file: photo,
      currentCount: 0,
      gate: gate(),
      upload: async () => farmBody,
      onPending: () => undefined,
    });
    expect(uploaded.status).toBe('saved');
    expect(patched).toBe(false);

    const cancelled = await submitFarmPhotoDelete({
      gate: gate(),
      ask: async () => 'cancel',
      remove: async () => {
        patched = true;
        return farmBody;
      },
      onPending: () => undefined,
    });
    expect(cancelled.status).toBe('cancelled');
    expect(patched).toBe(false);

    const deleted = await submitFarmPhotoDelete({
      gate: gate(),
      ask: async () => 'confirm',
      remove: async () => farmBody,
      onPending: () => undefined,
    });
    expect(deleted.status).toBe('saved');

    const primary = await submitFarmPhotoPrimary({
      gate: gate(),
      setPrimary: async () => farmBody,
      onPending: () => undefined,
    });
    expect(primary.status).toBe('saved');
  });

  it('sends the exact API photo type on the native part', () => {
    for (const [mimeType, type] of [
      ['image/jpeg', 'image/jpeg'],
      ['image/jpg', 'image/jpeg'],
      ['Image/PNG', 'image/png'],
      ['image/webp', 'image/webp'],
    ] as const) {
      const file = { ...photo, mimeType };
      expect(farmPhotoIssue(file, 0)).toBeNull();
      expect(resolveFarmPhotoMime(file)).toBe(type);
      const append = jest.fn();
      fillFarmPhotoForm({ append }, file, true);
      expect(append.mock.calls).toEqual([['file', { uri: photo.uri, name: photo.name, type }]]);
    }
  });

  it('rejects photos without a supported type and never builds a typeless native part', async () => {
    for (const mimeType of [null, undefined, '', 'application/octet-stream', 'image/gif', 'image/heic']) {
      const file = { ...photo, mimeType };
      expect(resolveFarmPhotoMime(file)).toBeNull();
      expect(farmPhotoIssue(file, 0)).toBe('unsupported');
      expect(() => fillFarmPhotoForm({ append: jest.fn() }, file, true)).toThrow();
    }
    const upload = jest.fn();
    const result = await submitFarmPhotoUpload({
      file: { ...photo, mimeType: null },
      currentCount: 0,
      gate: gate(),
      upload,
      onPending: () => undefined,
    });
    expect(result).toEqual({ status: 'invalid', issue: 'unsupported' });
    expect(upload).not.toHaveBeenCalled();
  });

  it('ignores a second photo tap while one is in flight', async () => {
    const busy = gate();
    busy.pending = true;
    expect(
      (
        await submitFarmPhotoUpload({
          file: photo,
          currentCount: 0,
          gate: busy,
          upload: async () => farmBody,
          onPending: () => undefined,
        })
      ).status,
    ).toBe('ignored');
  });
});

describe('farm verification documents', () => {
  it('uploads identity documents with the API fields and treats that as submission', async () => {
    const form = new FormData();
    fillFarmDocumentForm(form, { title: 'Passport', kind: 'idCard', file }, false);
    expect(form.get('title')).toBe('Passport');
    expect(form.get('kind')).toBe('idCard');
    expect(form.get('file')).toBeTruthy();
    expect(identityUploadSubmitsReview('idCard')).toBe(true);
    expect(identityUploadSubmitsReview('other')).toBe(false);
    expect(farmDocumentIssue({ ...file, mimeType: 'text/plain' }, 'Passport', 0)).toBe('unsupported');
    expect(farmDocumentIssue({ ...file, fileSize: FARM_DOCUMENT_MAX_BYTES + 1 }, 'Passport', 0)).toBe(
      'tooLarge',
    );
    expect(farmDocumentIssue(file, 'Passport', FARM_DOCUMENT_MAX_COUNT)).toBe('maxReached');
    expect(farmDocumentIssue(file, '  ', 0)).toBe('titleRequired');

    let profilePatched = false;
    const uploaded = await submitFarmDocumentUpload({
      file,
      title: 'Passport',
      kind: 'idCard',
      currentCount: 0,
      gate: gate(),
      upload: async () => {
        profilePatched = false;
        return { id: 'd1' };
      },
      onPending: () => undefined,
    });
    expect(uploaded).toEqual({ status: 'saved', value: { submitsReview: true } });
    expect(profilePatched).toBe(false);
  });

  it('sends the exact API document type on the native part', () => {
    const cases: [Partial<typeof file>, string][] = [
      [{ name: 'id.pdf', mimeType: 'application/pdf' }, 'application/pdf'],
      [{ name: 'id.pdf', mimeType: 'application/octet-stream' }, 'application/pdf'],
      [{ name: 'ID.PDF', mimeType: undefined }, 'application/pdf'],
      [{ name: 'id.jpg', mimeType: 'image/jpg' }, 'image/jpeg'],
      [{ name: 'id.png', mimeType: 'image/png' }, 'image/png'],
      [{ name: 'id.webp', mimeType: 'image/webp' }, 'image/webp'],
    ];
    for (const [change, type] of cases) {
      const doc = { ...file, ...change };
      expect(farmDocumentIssue(doc, 'Passport', 0)).toBeNull();
      expect(resolveFarmDocumentMime(doc)).toBe(type);
      const append = jest.fn();
      fillFarmDocumentForm({ append }, { title: ' Passport ', kind: 'idCard', file: doc }, true);
      expect(append.mock.calls).toEqual([
        ['title', 'Passport'],
        ['kind', 'idCard'],
        ['file', { uri: doc.uri, name: doc.name, type }],
      ]);
    }
  });

  it('uses a File off React Native and a typed part on React Native through the API wrapper', async () => {
    const requests: { url: string; method: string; contentType: string | null }[] = [];
    const api = new ApiClient({
      baseUrl: 'https://api.agrobridge.ge/api',
      getAccessToken: async () => 'token',
      onUnauthorized: () => undefined,
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method ?? 'GET',
          contentType: new Headers(init?.headers).get('content-type'),
        });
        return new Response(JSON.stringify({ id: 'd1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });
    const doc = { ...file, mimeType: 'application/octet-stream' };
    const append = jest.spyOn(FormData.prototype, 'append');
    try {
      await uploadFarmDocument(api, { title: ' Passport ', kind: 'idCard', file: doc });
      const hosted = append.mock.calls.find(([field]) => field === 'file')?.[1];
      expect(hosted).toBeInstanceOf(File);
      expect((hosted as File).type).toBe('application/pdf');
      append.mockClear();

      await asReactNative(() => uploadFarmDocument(api, { title: ' Passport ', kind: 'idCard', file: doc }));
      expect(append.mock.calls).toEqual([
        ['title', 'Passport'],
        ['kind', 'idCard'],
        ['file', { uri: doc.uri, name: doc.name, type: 'application/pdf' }],
      ]);
      expect(requests).toEqual([
        { url: 'https://api.agrobridge.ge/api/farms/me/documents', method: 'POST', contentType: null },
        { url: 'https://api.agrobridge.ge/api/farms/me/documents', method: 'POST', contentType: null },
      ]);

      await expect(
        asReactNative(() =>
          uploadFarmDocument(api, {
            title: 'Passport',
            kind: 'idCard',
            file: { ...file, name: 'id', mimeType: 'application/octet-stream' },
          }),
        ),
      ).rejects.toThrow();
      expect(requests).toHaveLength(2);
    } finally {
      append.mockRestore();
    }
  });

  it('rejects unresolvable document types locally and never builds a typeless native part', async () => {
    const cases: Partial<typeof file>[] = [
      { name: 'id', mimeType: 'application/octet-stream' },
      { name: 'id.docx', mimeType: undefined },
      { name: 'id.pdf', mimeType: 'text/plain' },
    ];
    for (const change of cases) {
      const doc = { ...file, ...change };
      expect(resolveFarmDocumentMime(doc)).toBeNull();
      expect(farmDocumentIssue(doc, 'Passport', 0)).toBe('unsupported');
      expect(() =>
        fillFarmDocumentForm({ append: jest.fn() }, { title: 'Passport', kind: 'idCard', file: doc }, true),
      ).toThrow();
    }
    const upload = jest.fn();
    const result = await submitFarmDocumentUpload({
      file: { ...file, name: 'id', mimeType: 'application/octet-stream' },
      title: 'Passport',
      kind: 'idCard',
      currentCount: 0,
      gate: gate(),
      upload,
      onPending: () => undefined,
    });
    expect(result).toEqual({ status: 'invalid', issue: 'unsupported' });
    expect(upload).not.toHaveBeenCalled();
  });

  it('keeps the farm profile available when verification status fails', () => {
    expect(verificationSectionState({ hasFarm: true, verification: null, failed: true })).toBe('unavailable');
    expect(verificationSectionState({ hasFarm: false, verification: null, failed: true })).toBe('hidden');
  });

  it('renders verification status and the moderator note', () => {
    const status = parseFarmVerification({
      verified: false,
      farmVerificationStatus: 'rejected',
      verificationReasonCode: 'documentRejected',
      moderatorComment: 'Photo is unreadable',
      sellerType: 'privateFarmer',
      phoneVerified: true,
      sellerTypeLocked: true,
      path: 'privateFarmer',
    });
    expect(status?.farmVerificationStatus).toBe('rejected');
    expect(status?.moderatorComment).toBe('Photo is unreadable');
  });

  it('confirms document deletion and keeps an approved identity document', async () => {
    expect(
      approvedPrimaryDocumentLocked('approved', { kind: 'idCard', reviewStatus: 'approved' }),
    ).toBe(true);
    const locked = await submitFarmDocumentDelete({
      locked: true,
      gate: gate(),
      ask: async () => 'confirm',
      remove: async () => undefined,
      onPending: () => undefined,
    });
    expect(locked).toEqual({ status: 'invalid', issue: 'deleteBlocked' });

    const removed = await submitFarmDocumentDelete({
      locked: false,
      gate: gate(),
      ask: async () => 'confirm',
      remove: async () => undefined,
      onPending: () => undefined,
    });
    expect(removed.status).toBe('saved');

    const failed = await submitFarmDocumentDelete({
      locked: false,
      gate: gate(),
      ask: async () => 'confirm',
      remove: async () => {
        throw new ApiError({ message: 'missing', status: 404, kind: 'http' });
      },
      onPending: () => undefined,
    });
    expect(failed).toEqual({ status: 'failed', failure: 'notFound' });
  });

  it('opens a document only through the authenticated file route', () => {
    expect(farmDocumentFilePath('doc-1')).toBe('/farms/documents/doc-1/file');
    expect(farmDocumentDownloadUrl('https://api.agrobridge.ge/api', 'doc-1')).toBe(
      'https://api.agrobridge.ge/api/farms/documents/doc-1/file',
    );
    expect(farmDocumentDownloadUrl('https://api.agrobridge.ge/api', 'doc-1')).not.toContain('uploads');
  });
});

function farmWriteValues() {
  return {
    name: 'Kakheti Orchard',
    region: 'kakheti',
    description: '',
    foundedYear: '',
    farmSizeHectares: '',
    producerType: '' as const,
    exportMarkets: '',
    history: '',
  };
}
