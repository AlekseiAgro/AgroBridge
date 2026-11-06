import { ApiClient } from '../api/client';
import { ApiError } from '../api/errors';
import {
  CERTIFICATE_MAX_BYTES,
  CERTIFICATE_TYPES,
  canAddCertificate,
  certificateDownloadUrl,
  certificateFileIssue,
  certificateTitleIssue,
  classifyCertificateBytes,
  fillCertificateForm,
  openCertificateDocument,
  parseProductCertificates,
  submitCertificateDelete,
  submitCertificateUpload,
  type CertificateFile,
  type CertificateType,
} from './certificates';
import { uploadProductCertificate } from './certificates-api';
import type { DraftGate } from './draft';
import { parseSellerProductDetail } from './edit';

const pdf: CertificateFile = {
  uri: 'file:///gap.pdf',
  name: 'gap.pdf',
  mimeType: 'application/pdf',
  fileSize: 2048,
};

function owner(extra: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    isOwner: true,
    title: 'Green tea',
    moderationStatus: 'approved',
    isPublished: true,
    moderationNote: null,
    certificates: [],
    ...extra,
  };
}

function certificate(type: CertificateType, reviewStatus = 'pending', reviewNote: string | null = null) {
  return {
    id: `c-${type}`,
    type,
    title: `${type} certificate`,
    fileName: `${type}.pdf`,
    mimeType: 'application/pdf',
    reviewStatus,
    reviewNote,
  };
}

describe('product certificates', () => {
  it('accepts PDF, JPEG, PNG, and WebP and rejects other files and files over 10 MB', () => {
    expect(classifyCertificateBytes(Uint8Array.from([0x25, 0x50, 0x44, 0x46]))).toBe('application/pdf');
    expect(certificateFileIssue(pdf, 0)).toBeNull();
    expect(certificateFileIssue({ ...pdf, name: 'scan.jpg', mimeType: 'image/jpeg' }, 0)).toBeNull();
    expect(certificateFileIssue({ ...pdf, name: 'scan.png', mimeType: 'image/png' }, 0)).toBeNull();
    expect(certificateFileIssue({ ...pdf, name: 'scan.webp', mimeType: 'image/webp' }, 0)).toBeNull();
    expect(certificateFileIssue({ ...pdf, name: 'scan.jpg', mimeType: 'image/jpg' }, 0)).toBeNull();
    expect(certificateFileIssue({ ...pdf, name: 'notes.txt', mimeType: 'text/plain' }, 0)).toBe('unsupported');
    expect(certificateFileIssue({ ...pdf, fileSize: CERTIFICATE_MAX_BYTES + 1 }, 0)).toBe('tooLarge');
    expect(certificateFileIssue({ ...pdf, fileSize: CERTIFICATE_MAX_BYTES }, 9)).toBeNull();
    expect(certificateFileIssue(pdf, 10)).toBe('maxReached');
    expect(canAddCertificate(10)).toBe(false);
    expect(canAddCertificate(9)).toBe(true);
  });

  it('requires a title and sends type, title, and file for every certificate type', async () => {
    expect(certificateTitleIssue('  ')).toBe('titleRequired');
    expect(certificateTitleIssue(' GLOBALG.A.P. 2026 ')).toBeNull();
    const calls: { url: string; method: string; type: FormDataEntryValue | null; title: FormDataEntryValue | null }[] = [];
    const api = new ApiClient({
      baseUrl: 'https://api.agrobridge.ge/api',
      getAccessToken: async () => 'token',
      onUnauthorized: () => undefined,
      fetchImpl: async (input, init) => {
        const body = init?.body as FormData;
        calls.push({
          url: String(input),
          method: init?.method ?? 'GET',
          type: body.get('type'),
          title: body.get('title'),
        });
        const type = String(body.get('type'));
        return new Response(JSON.stringify(owner({ certificates: [certificate(type as CertificateType)] })), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });
    for (const type of CERTIFICATE_TYPES) {
      const product = await uploadProductCertificate(api, 'p1', type, ' GLOBALG.A.P. 2026 ', pdf);
      expect(product.certificates[0]?.type).toBe(type);
    }
    expect(calls).toHaveLength(CERTIFICATE_TYPES.length);
    expect(calls.every((call) => call.method === 'POST')).toBe(true);
    expect(calls.every((call) => call.url === 'https://api.agrobridge.ge/api/products/p1/certificates')).toBe(true);
    expect(calls.map((call) => call.type)).toEqual([...CERTIFICATE_TYPES]);
    expect(calls.every((call) => call.title === 'GLOBALG.A.P. 2026')).toBe(true);
    const form = new FormData();
    fillCertificateForm(form, { type: 'haccp', title: ' HACCP ', file: pdf }, false);
    expect(form.get('file')).toBeInstanceOf(File);
  });

  it('keeps review status and the review note from the product response', () => {
    const certificates = parseProductCertificates([
      certificate('organic', 'pending', null),
      certificate('haccp', 'approved', null),
      certificate('iso', 'rejected', '  Scan is unreadable  '),
    ]);
    expect(certificates.map((item) => item.reviewStatus)).toEqual(['pending', 'approved', 'rejected']);
    expect(certificates[2]?.reviewNote).toBe('Scan is unreadable');
    expect(certificates[2]?.fileName).toBe('iso.pdf');
  });

  it('does not upload without a file or past the limit, and does not patch the product', async () => {
    const upload = jest.fn(async () => parseSellerProductDetail(owner())!);
    const save = jest.fn();
    const missing = await submitCertificateUpload({
      productId: 'p1',
      type: 'organic',
      title: '',
      file: pdf,
      currentCount: 0,
      gate: { pending: false },
      upload,
      onPending: () => undefined,
    });
    expect(missing).toEqual({ status: 'invalid', issue: 'titleRequired' });
    const full = await submitCertificateUpload({
      productId: 'p1',
      type: 'organic',
      title: 'Organic',
      file: pdf,
      currentCount: 10,
      gate: { pending: false },
      upload,
      onPending: () => undefined,
    });
    expect(full).toEqual({ status: 'invalid', issue: 'maxReached' });
    expect(upload).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('confirms certificate deletion and ignores a second tap', async () => {
    const remove = jest.fn();
    const cancelled = await submitCertificateDelete({
      productId: 'p1',
      certificateId: 'c1',
      ask: async () => 'cancel',
      gate: { pending: false },
      remove,
      onPending: () => undefined,
    });
    expect(cancelled).toEqual({ status: 'cancelled' });
    expect(remove).not.toHaveBeenCalled();

    const gate: DraftGate = { pending: false };
    let release: (choice: 'cancel' | 'confirm') => void = () => undefined;
    const first = submitCertificateDelete({
      productId: 'p1',
      certificateId: 'c1',
      ask: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
      gate,
      remove: async () => parseSellerProductDetail(owner({ certificates: [] }))!,
      onPending: () => undefined,
    });
    expect(
      await submitCertificateDelete({
        productId: 'p1',
        certificateId: 'c1',
        ask: async () => 'confirm',
        gate,
        remove: async () => parseSellerProductDetail(owner())!,
        onPending: () => undefined,
      }),
    ).toEqual({ status: 'ignored' });
    release('confirm');
    await expect(first).resolves.toMatchObject({ status: 'deleted' });
  });

  it('opens the private certificate file and reports when sharing is unavailable', async () => {
    const download = jest.fn(async (path: string) => ({ uri: `file://${path}` }));
    const share = jest.fn(async () => undefined);
    const opened = await openCertificateDocument({
      productId: 'p1',
      certificateId: 'c1',
      fileName: 'gap.pdf',
      download,
      canShare: async () => true,
      share,
    });
    expect(opened).toBe('opened');
    expect(download).toHaveBeenCalledWith('/products/p1/certificates/c1/file', 'gap.pdf');
    expect(certificateDownloadUrl('https://api.agrobridge.ge/api', 'p1', 'c1')).toBe(
      'https://api.agrobridge.ge/api/products/p1/certificates/c1/file',
    );
    expect(share).toHaveBeenCalledWith('file:///products/p1/certificates/c1/file');
    const unavailable = await openCertificateDocument({
      productId: 'p1',
      certificateId: 'c1',
      fileName: 'gap.pdf',
      download,
      canShare: async () => false,
      share,
    });
    expect(unavailable).toBe('unavailable');
    const headers = await new ApiClient({
      baseUrl: 'https://api.agrobridge.ge/api',
      getAccessToken: async () => 'token',
      onUnauthorized: () => undefined,
    }).authHeaders();
    expect(headers).toEqual({ Authorization: 'Bearer token' });
  });

  it('keeps the certificate when upload or delete fails', async () => {
    const uploadFailed = await submitCertificateUpload({
      productId: 'p1',
      type: 'organic',
      title: 'Organic',
      file: pdf,
      currentCount: 0,
      gate: { pending: false },
      upload: async () => {
        throw new ApiError({ message: 'Certificate is too large', status: 400, kind: 'http' });
      },
      onPending: () => undefined,
    });
    expect(uploadFailed).toEqual({ status: 'failed', failure: 'validation' });
    const deleteFailed = await submitCertificateDelete({
      productId: 'p1',
      certificateId: 'c1',
      ask: async () => 'confirm',
      gate: { pending: false },
      remove: async () => {
        throw new ApiError({ message: 'Certificate not found', status: 404, kind: 'http' });
      },
      onPending: () => undefined,
    });
    expect(deleteFailed).toEqual({ status: 'failed', failure: 'notFound' });
  });
});
