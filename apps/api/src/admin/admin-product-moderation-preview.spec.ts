import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web/src');
const WEB_MESSAGES = join(__dirname, '../../../web/messages');
const API = join(__dirname, '..');

function readWeb(path: string) {
  return readFileSync(join(WEB, path), 'utf8');
}

function readApi(path: string) {
  return readFileSync(join(API, path), 'utf8');
}

function readMessage(locale: string) {
  return readFileSync(join(WEB_MESSAGES, `${locale}.json`), 'utf8');
}

describe('admin product moderation preview', () => {
  const queue = readWeb('app/[locale]/dashboard/admin/page.tsx');
  const preview = readWeb('app/[locale]/dashboard/admin/products/[id]/page.tsx');
  const presentation = readWeb('components/ProductModerationPreview.tsx');
  const actions = readWeb('components/ModerationActions.tsx');
  const controller = readApi('admin/admin.controller.ts');
  const service = readApi('admin/admin.service.ts');
  const notifications = readApi('mail/notifications.service.ts');
  const notificationsSpec = readApi('mail/notifications.service.spec.ts');

  it('opens a dedicated admin preview from the existing queue', () => {
    expect(queue).toContain('href={`/dashboard/admin/products/${product.id}`}');
    expect(queue).toContain("t('openPreview')");
    expect(queue).toContain('<ModerationActions productId={product.id} />');
    expect(preview).toContain('apiRequestAuthed<ProductDetail>(`/admin/products/${id}`)');
    expect(preview).not.toContain('`/products/${id}`');
    expect(preview).toContain('<ProductModerationPreview');
    expect(preview).toContain('<ModerationActions');
    expect(preview).toContain('returnHref={queueHref}');
  });

  it('keeps the moderation notification deep-link on the existing queue', () => {
    expect(notifications).toContain(
      '`/dashboard/admin?section=products&status=pending`',
    );
    expect(notificationsSpec).toContain(
      'http://localhost:3000/ru/dashboard/admin?section=products&status=pending',
    );
    expect(queue).toContain("href={`/dashboard/admin?section=products&status=${tab}`}");
  });

  it('loads full product details only through the admin-guarded endpoint', () => {
    expect(controller).toContain("@Get('products/:id')");
    expect(controller).toContain("@Roles('admin')");
    expect(controller).toContain('JwtAuthGuard');
    expect(service).toContain('return this.products.getById(id, user);');
  });

  it('reuses product-detail fields without buyer marketplace actions', () => {
    expect(presentation).toContain('product.images');
    expect(presentation).toContain('product.priceFrom');
    expect(presentation).toContain('product.attributes');
    expect(presentation).toContain('product.farm');
    expect(presentation).toContain("t('sections.attributes')");
    expect(presentation).not.toContain('RfqRequestForm');
    expect(presentation).not.toContain('HarvestWatchButton');
    expect(presentation).not.toContain('OpenChatButton');
    expect(preview).toContain("t(previewStatusKey(product.moderationStatus))");
    expect(preview).toContain("if (status === 'pending') return 'previewPending'");
  });

  it('keeps existing approve and reject actions', () => {
    expect(actions).toContain("fetch(`/api/admin/products/${productId}/${action}`");
    expect(actions).toContain("t('approve')");
    expect(actions).toContain("t('reject')");
    expect(actions).toContain("t('rejectNote')");
    expect(controller).toContain("@Post('products/:id/approve')");
    expect(controller).toContain("@Post('products/:id/reject')");
  });

  it('localizes the new preview strings in every locale', () => {
    for (const locale of ['en', 'ru', 'ka', 'de', 'fr', 'it', 'es']) {
      const messages = readMessage(locale);
      expect(messages).toContain('"openPreview"');
      expect(messages).toContain('"previewTitle"');
      expect(messages).toContain('"previewPending"');
      expect(messages).toContain('"backToQueue"');
    }
  });
});
