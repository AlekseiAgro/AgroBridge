import { certificateFileIssue, fillCertificateForm } from './certificates';
import { farmDocumentIssue, farmPhotoIssue, fillFarmDocumentForm, fillFarmPhotoForm } from './farm';
import { fillProductImageForm, photoFileIssue, type ProductPhotoFile } from './photos';
import { fillProductVideoForm, videoFileIssue } from './video';

/** Backend allow-lists from packages/shared (catalog.ts, quality.ts, verification.ts). */
const API_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const API_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const API_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

type Form = { append(name: string, value: unknown): void };

type UploadKind = {
  label: string;
  allowed: string[];
  issue: (file: ProductPhotoFile) => string | null;
  fill: (form: Form, file: ProductPhotoFile) => void;
};

const kinds: UploadKind[] = [
  {
    label: 'product photo',
    allowed: API_IMAGE_TYPES,
    issue: (file) => photoFileIssue(file, 0),
    fill: (form, file) => fillProductImageForm(form as FormData, file, true),
  },
  {
    label: 'product video',
    allowed: API_VIDEO_TYPES,
    issue: (file) => videoFileIssue(file),
    fill: (form, file) => fillProductVideoForm(form as FormData, file, true),
  },
  {
    label: 'certificate',
    allowed: API_DOCUMENT_TYPES,
    issue: (file) => certificateFileIssue(file, 0),
    fill: (form, file) => fillCertificateForm(form as FormData, { type: 'organic', title: 'Organic', file }, true),
  },
  {
    label: 'farm photo',
    allowed: API_IMAGE_TYPES,
    issue: (file) => farmPhotoIssue(file, 0),
    fill: (form, file) => fillFarmPhotoForm(form, file, true),
  },
  {
    label: 'farm document',
    allowed: API_DOCUMENT_TYPES,
    issue: (file) => farmDocumentIssue(file, 'Passport', 0),
    fill: (form, file) => fillFarmDocumentForm(form, { title: 'Passport', kind: 'idCard', file }, true),
  },
];

const names = [
  'file.jpg',
  'file.jpeg',
  'FILE.JPG',
  'file.png',
  'FILE.PNG',
  'file.webp',
  'file.pdf',
  'FILE.PDF',
  'file.mp4',
  'file.m4v',
  'file.mov',
  'FILE.MOV',
  'file.webm',
  'file.gif',
  'file',
];
const mimeTypes = [
  null,
  undefined,
  '',
  'application/octet-stream',
  'APPLICATION/OCTET-STREAM',
  'image/jpeg',
  'IMAGE/JPEG',
  'image/jpg',
  'image/pjpeg',
  'IMAGE/PJPEG',
  'image/png',
  'Image/PNG',
  'APPLICATION/PDF',
  'VIDEO/MP4',
  'Video/QuickTime',
  'image/webp',
  'image/gif',
  'image/heic',
  'application/pdf',
  'video/mp4',
  'video/quicktime',
  'video/mov',
  'video/x-quicktime',
  'video/webm',
  'video/x-m4v',
  'text/plain',
];

describe('native upload parts', () => {
  for (const kind of kinds) {
    it(`${kind.label}: validation and the native part agree, and every part carries an API type`, () => {
      let accepted = 0;
      for (const name of names) {
        for (const mimeType of mimeTypes) {
          const file: ProductPhotoFile = { uri: `file:///${name}`, name, mimeType, fileSize: 1000 };
          const appended: [string, unknown][] = [];
          const form: Form = { append: (field, value) => appended.push([field, value]) };
          if (kind.issue(file) !== null) {
            expect([name, mimeType, kind.issue(file)]).toEqual([name, mimeType, 'unsupported']);
            expect(() => kind.fill(form, file)).toThrow();
            continue;
          }
          kind.fill(form, file);
          accepted += 1;
          const parts = appended.filter(([field]) => field === 'file');
          expect(parts).toHaveLength(1);
          const part = parts[0]?.[1] as { uri: string; name: string; type?: unknown };
          expect(part).toEqual({ uri: file.uri, name, type: expect.any(String) });
          expect(kind.allowed).toContain(part.type);
        }
      }
      expect(accepted).toBeGreaterThan(0);
    });
  }

  const expected: [string, string, string | null, string | null][] = [
    ['product photo', 'file.jpg', 'image/pjpeg', 'image/jpeg'],
    ['product photo', 'file.jpg', 'IMAGE/JPEG', 'image/jpeg'],
    ['product photo', 'FILE.JPG', null, null],
    ['farm photo', 'file.jpeg', 'IMAGE/PJPEG', 'image/jpeg'],
    ['farm photo', 'FILE.PNG', 'Image/PNG', 'image/png'],
    ['product video', 'FILE.MOV', null, 'video/quicktime'],
    ['product video', 'file.m4v', 'APPLICATION/OCTET-STREAM', 'video/mp4'],
    ['product video', 'file.mov', 'Video/QuickTime', 'video/quicktime'],
    ['product video', 'file', 'VIDEO/MP4', 'video/mp4'],
    ['certificate', 'FILE.PDF', null, 'application/pdf'],
    ['certificate', 'file.jpeg', 'application/octet-stream', 'image/jpeg'],
    ['certificate', 'file.jpg', 'IMAGE/PJPEG', 'image/jpeg'],
    ['certificate', 'file', 'APPLICATION/PDF', 'application/pdf'],
    ['farm document', 'FILE.PDF', 'APPLICATION/OCTET-STREAM', 'application/pdf'],
    ['farm document', 'FILE.JPG', null, 'image/jpeg'],
    ['farm document', 'file.pdf', 'image/pjpeg', 'image/jpeg'],
  ];
  for (const [label, name, mimeType, type] of expected) {
    it(`${label}: ${name} declared as ${String(mimeType)} sends ${String(type)}`, () => {
      const kind = kinds.find((item) => item.label === label);
      const file: ProductPhotoFile = { uri: `file:///${name}`, name, mimeType, fileSize: 1000 };
      const appended: [string, unknown][] = [];
      const form: Form = { append: (field, value) => appended.push([field, value]) };
      if (type === null) {
        expect(kind?.issue(file)).toBe('unsupported');
        expect(() => kind?.fill(form, file)).toThrow();
        return;
      }
      expect(kind?.issue(file)).toBeNull();
      kind?.fill(form, file);
      expect(appended.find(([field]) => field === 'file')?.[1]).toEqual({ uri: file.uri, name, type });
    });
  }
});
