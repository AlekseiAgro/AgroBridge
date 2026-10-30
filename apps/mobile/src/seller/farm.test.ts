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
  submitFarmDocumentDelete,
  submitFarmDocumentUpload,
  submitFarmPhotoDelete,
  submitFarmPhotoPrimary,
  submitFarmPhotoUpload,
  submitFarmSave,
  verificationSectionState,
} from './farm';

const gate = (): DraftGate => ({ pending: false });

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
