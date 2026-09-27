import { readFileSync } from 'fs';
import { join } from 'path';

const API = join(__dirname, '..');
const SHARED = join(__dirname, '../../../../packages/shared/src');

function readApi(path: string) {
  return readFileSync(join(API, path), 'utf8');
}

function readShared(path: string) {
  return readFileSync(join(SHARED, path), 'utf8');
}

describe('admin/moderator user-impacting in-app notifications', () => {
  const notifications = readApi('mail/notifications.service.ts');
  const admin = readApi('admin/admin.service.ts');
  const verification = readApi('verification/verification.service.ts');
  const types = readShared('notification.ts');
  const controller = readApi('notifications/notifications.controller.ts');

  it('covers existing admin decisions without inventing a second notification stack', () => {
    expect(notifications).toContain('persistInAppIfRecipient');
    expect(notifications).toContain('PrismaUserNotificationType.productApproved');
    expect(notifications).toContain('PrismaUserNotificationType.productRejected');
    expect(notifications).toContain('PrismaUserNotificationType.verificationApproved');
    expect(notifications).toContain('PrismaUserNotificationType.verificationRejected');
    expect(notifications).toContain('PrismaUserNotificationType.farmDocumentApproved');
    expect(notifications).toContain('PrismaUserNotificationType.purchaseRequestModerated');
    expect(admin).toContain('notifyFarmDocumentReviewed');
    expect(admin).toContain('notifyProductCertificateReviewed');
    expect(admin).toContain('notifyPurchaseRequestModerated');
    expect(verification).toContain('notifyVerificationApproved');
    expect(verification).toContain('notifyVerificationRejected');
  });

  it('keeps email for product and farm verification decisions', () => {
    expect(notifications).toContain("sendTemplate(params.farmer, 'productApproved'");
    expect(notifications).toContain("sendTemplate(params.farmer, 'productRejected'");
    expect(notifications).toContain("sendTemplate(params.farmer, 'verificationApproved'");
    expect(notifications).toContain("sendTemplate(params.farmer, 'verificationRejected'");
  });

  it('does not invent email for document, certificate, or admin-cancelled request alerts', () => {
    const documentMethod = notifications.slice(
      notifications.indexOf('async notifyFarmDocumentReviewed'),
      notifications.indexOf('async notifyProductCertificateReviewed'),
    );
    const certificateMethod = notifications.slice(
      notifications.indexOf('async notifyProductCertificateReviewed'),
      notifications.indexOf('async notifyPurchaseRequestModerated'),
    );
    const moderatedMethod = notifications.slice(
      notifications.indexOf('async notifyPurchaseRequestModerated'),
      notifications.indexOf('async notifyNewProductListing'),
    );
    expect(documentMethod).not.toContain('sendTemplate');
    expect(certificateMethod).not.toContain('sendTemplate');
    expect(moderatedMethod).not.toContain('sendTemplate');
  });

  it('stores only titles, reasons, and cabinet links in the in-app payload', () => {
    expect(admin).toContain('documentTitle: existing.title');
    expect(admin).toContain('certificateTitle: existing.title');
    expect(notifications).toContain("href = '/dashboard/farm'");
    expect(notifications).toContain("href = '/dashboard/purchase-requests'");
    expect(notifications).toContain('persistInAppIfRecipient');
    expect(notifications).not.toContain('farms/');
  });

  it('marks notifications read only for the owner', () => {
    expect(controller).toContain('this.notifications.markRead(user.id, id)');
    expect(controller).toContain('@UseGuards(JwtAuthGuard, EmailVerifiedGuard)');
    expect(notifications).toContain('where: { id, userId }');
  });

  it('registers admin-decision types without adding them to quote/request badges', () => {
    expect(types).toContain("'productApproved'");
    expect(types).toContain("'purchaseRequestModerated'");
    expect(types).toContain('admin-decision types');
    expect(types).toContain("'purchaseQuoteReceived'");
    expect(types).toContain('PURCHASE_REQUEST_UNREAD_TYPES');
  });
});
