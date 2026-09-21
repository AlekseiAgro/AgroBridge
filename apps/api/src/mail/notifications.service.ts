import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserNotificationType as PrismaUserNotificationType } from '@prisma/client';
import type { Locale } from '@agrobridge/shared';
import {
  DEFAULT_LOCALE,
  EMPTY_NOTIFICATION_UNREAD_SUMMARY,
  isHarvestStatus,
  isLocale,
  isUserNotificationType,
  localizeProductTitle,
  summarizeUnreadByType,
  type NotificationUnreadSummary,
  type UserNotificationItem,
  type VerificationReasonCode,
} from '@agrobridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { renderEmailTemplate } from './email-templates';
import { sanitizeMailError } from './mail.config';
import { MailService } from './mail.service';
import type { MailRecipient } from './mail.types';

const HARVEST_STATUS_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    growing: 'growing',
    available: 'available',
    limited: 'limited',
    soldOut: 'sold out',
  },
  ru: {
    growing: 'растёт',
    available: 'доступно',
    limited: 'ограничено',
    soldOut: 'распродано',
  },
  ka: {
    growing: 'იზრდება',
    available: 'ხელმისაწვდომია',
    limited: 'შეზღუდულია',
    soldOut: 'გაყიდულია',
  },
  de: {
    growing: 'wächst',
    available: 'verfügbar',
    limited: 'begrenzt',
    soldOut: 'ausverkauft',
  },
  fr: {
    growing: 'en croissance',
    available: 'disponible',
    limited: 'limité',
    soldOut: 'épuisé',
  },
  it: {
    growing: 'in crescita',
    available: 'disponibile',
    limited: 'limitato',
    soldOut: 'esaurito',
  },
  es: {
    growing: 'en crecimiento',
    available: 'disponible',
    limited: 'limitado',
    soldOut: 'agotado',
  },
};

/**
 * Producer-facing wording for a verification refusal. The stored reason is a code, so the
 * seller always reads their own language instead of the moderation internals.
 */
const VERIFICATION_REASON_LABELS: Record<
  Locale,
  Record<VerificationReasonCode | 'unspecified', string>
> = {
  en: {
    documentRejected: 'The verification document was not accepted by the moderator.',
    registryNotConfirmed: 'The company registration could not be confirmed.',
    contactConfirmationRequired: 'Email and phone confirmation is still missing.',
    moderatorRejected: 'The moderator did not approve the verification.',
    unspecified: 'The verification requirements were not met.',
  },
  ru: {
    documentRejected: 'Модератор не принял документ для верификации.',
    registryNotConfirmed: 'Регистрацию компании не удалось подтвердить.',
    contactConfirmationRequired: 'Не подтверждены email и телефон.',
    moderatorRejected: 'Модератор не одобрил верификацию.',
    unspecified: 'Требования верификации не выполнены.',
  },
  ka: {
    documentRejected: 'მოდერატორმა არ მიიღო ვერიფიკაციის დოკუმენტი.',
    registryNotConfirmed: 'კომპანიის რეგისტრაციის დადასტურება ვერ მოხერხდა.',
    contactConfirmationRequired: 'ელფოსტა და ტელეფონი ჯერ არ არის დადასტურებული.',
    moderatorRejected: 'მოდერატორმა ვერიფიკაცია არ დაადასტურა.',
    unspecified: 'ვერიფიკაციის მოთხოვნები არ არის შესრულებული.',
  },
  de: {
    documentRejected: 'Das Verifizierungsdokument wurde vom Moderator nicht akzeptiert.',
    registryNotConfirmed: 'Die Registrierung des Unternehmens konnte nicht bestätigt werden.',
    contactConfirmationRequired: 'E-Mail und Telefon sind noch nicht bestätigt.',
    moderatorRejected: 'Der Moderator hat die Verifizierung nicht bestätigt.',
    unspecified: 'Die Anforderungen an die Verifizierung wurden nicht erfüllt.',
  },
  fr: {
    documentRejected: 'Le document de vérification n’a pas été accepté par le modérateur.',
    registryNotConfirmed: 'L’enregistrement de l’entreprise n’a pas pu être confirmé.',
    contactConfirmationRequired: 'L’e-mail et le téléphone ne sont pas encore confirmés.',
    moderatorRejected: 'Le modérateur n’a pas approuvé la vérification.',
    unspecified: 'Les conditions de vérification ne sont pas remplies.',
  },
  it: {
    documentRejected: 'Il documento di verifica non è stato accettato dal moderatore.',
    registryNotConfirmed: 'Non è stato possibile confermare la registrazione dell’azienda.',
    contactConfirmationRequired: 'Email e telefono non sono ancora confermati.',
    moderatorRejected: 'Il moderatore non ha approvato la verifica.',
    unspecified: 'I requisiti di verifica non sono stati soddisfatti.',
  },
  es: {
    documentRejected: 'El moderador no aceptó el documento de verificación.',
    registryNotConfirmed: 'No se pudo confirmar el registro de la empresa.',
    contactConfirmationRequired: 'Faltan por confirmar el correo y el teléfono.',
    moderatorRejected: 'El moderador no aprobó la verificación.',
    unspecified: 'No se cumplieron los requisitos de verificación.',
  },
};

const MODERATOR_COMMENT_LABELS: Record<Locale, string> = {
  en: 'Moderator comment',
  ru: 'Комментарий модератора',
  ka: 'მოდერატორის კომენტარი',
  de: 'Kommentar des Moderators',
  fr: 'Commentaire du modérateur',
  it: 'Commento del moderatore',
  es: 'Comentario del moderador',
};

const SELLER_TYPE_LABELS: Record<Locale, Record<'privateFarmer' | 'company', string>> = {
  en: { privateFarmer: 'private farmer', company: 'company' },
  ru: { privateFarmer: 'частный фермер', company: 'компания' },
  ka: { privateFarmer: 'კერძო ფერმერი', company: 'კომპანია' },
  de: { privateFarmer: 'Privatlandwirt', company: 'Unternehmen' },
  fr: { privateFarmer: 'agriculteur privé', company: 'entreprise' },
  it: { privateFarmer: 'agricoltore privato', company: 'azienda' },
  es: { privateFarmer: 'agricultor privado', company: 'empresa' },
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly webPublicUrl: string;

  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.webPublicUrl = (
      this.config.get<string>('WEB_PUBLIC_URL') ??
      this.config.get<string>('WEB_ORIGIN')?.split(',')[0] ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  async notifyWelcome(user: {
    email: string;
    locale: string;
    displayName: string | null;
    role: string;
  }): Promise<void> {
    const locale = this.localeOf(user.locale);
    await this.sendTemplate(user, 'welcome', {
      name: this.displayName(user),
      role: user.role,
      link: this.appLink(locale, '/verify-email'),
    });
  }

  async notifyRfqCreated(params: {
    farmer: MailRecipient;
    buyerName: string;
    productTitle: string;
    quantity: string;
    unit: string | null;
    rfqId: string;
  }): Promise<void> {
    const locale = this.localeOf(params.farmer.locale);
    await this.sendTemplate(params.farmer, 'rfqCreated', {
      name: this.displayName(params.farmer),
      buyerName: params.buyerName,
      productTitle: params.productTitle,
      quantity: params.quantity,
      unit: params.unit ? ` ${params.unit}` : '',
      link: this.appLink(locale, `/dashboard/inbox/${params.rfqId}`),
    });
  }

  async notifyRfqOfferCreated(params: {
    buyer: MailRecipient;
    farmName: string;
    productTitle: string;
    priceAmount: string;
    currency: string;
    rfqId: string;
  }): Promise<void> {
    const locale = this.localeOf(params.buyer.locale);
    await this.sendTemplate(params.buyer, 'rfqOfferCreated', {
      name: this.displayName(params.buyer),
      farmName: params.farmName,
      productTitle: params.productTitle,
      priceAmount: params.priceAmount,
      currency: params.currency,
      link: this.appLink(locale, `/dashboard/rfqs/${params.rfqId}`),
    });
  }

  async notifyRfqAccepted(params: {
    farmer: MailRecipient;
    buyerName: string;
    productTitle: string;
    rfqId: string;
  }): Promise<void> {
    const locale = this.localeOf(params.farmer.locale);
    await this.sendTemplate(params.farmer, 'rfqAccepted', {
      name: this.displayName(params.farmer),
      buyerName: params.buyerName,
      productTitle: params.productTitle,
      link: this.appLink(locale, `/dashboard/inbox/${params.rfqId}`),
    });
  }

  async notifyRfqDeclinedByBuyer(params: {
    farmer: MailRecipient;
    buyerName: string;
    productTitle: string;
    rfqId: string;
  }): Promise<void> {
    const locale = this.localeOf(params.farmer.locale);
    await this.sendTemplate(params.farmer, 'rfqDeclinedByBuyer', {
      name: this.displayName(params.farmer),
      buyerName: params.buyerName,
      productTitle: params.productTitle,
      link: this.appLink(locale, `/dashboard/inbox/${params.rfqId}`),
    });
  }

  async notifyRfqDeclinedByFarmer(params: {
    buyer: MailRecipient;
    farmName: string;
    productTitle: string;
    rfqId: string;
  }): Promise<void> {
    const locale = this.localeOf(params.buyer.locale);
    await this.sendTemplate(params.buyer, 'rfqDeclinedByFarmer', {
      name: this.displayName(params.buyer),
      farmName: params.farmName,
      productTitle: params.productTitle,
      link: this.appLink(locale, `/dashboard/rfqs/${params.rfqId}`),
    });
  }

  async notifyRfqCancelled(params: {
    farmer: MailRecipient;
    buyerName: string;
    productTitle: string;
  }): Promise<void> {
    const locale = this.localeOf(params.farmer.locale);
    await this.sendTemplate(params.farmer, 'rfqCancelled', {
      name: this.displayName(params.farmer),
      buyerName: params.buyerName,
      productTitle: params.productTitle,
      link: this.appLink(locale, '/dashboard/inbox'),
    });
  }

  async notifyPurchaseQuoteReceived(params: {
    buyer: MailRecipient & { id: string };
    farmName: string;
    title: string;
    priceAmount: string;
    currency: string;
    requestId: string;
  }): Promise<void> {
    const locale = this.localeOf(params.buyer.locale);
    const href = `/requests/${params.requestId}`;
    const copy = this.purchaseQuoteReceivedCopy(locale, params.farmName, params.title);
    await this.createUserNotification({
      userId: params.buyer.id,
      type: PrismaUserNotificationType.purchaseQuoteReceived,
      productId: null,
      title: copy.title,
      body: copy.body,
      href,
    });
    await this.sendTemplate(params.buyer, 'purchaseQuoteReceived', {
      name: this.displayName(params.buyer),
      farmName: params.farmName,
      title: params.title,
      priceAmount: params.priceAmount,
      currency: params.currency,
      link: this.appLink(locale, href),
    });
  }

  /**
   * The winning seller keeps authorized access to the fulfilled request, so this link
   * points at the request itself rather than at the public open board.
   */
  async notifyPurchaseQuoteAccepted(params: {
    farmer: MailRecipient & { id: string };
    buyerName: string;
    buyerDisplayName?: string | null;
    title: string;
    requestId: string;
  }): Promise<void> {
    const locale = this.localeOf(params.farmer.locale);
    const href = `/requests/${params.requestId}`;
    const copy = this.purchaseQuoteAcceptedCopy(
      locale,
      this.inAppBuyerLabel(params.buyerDisplayName, locale),
      params.title,
    );
    await this.createUserNotification({
      userId: params.farmer.id,
      type: PrismaUserNotificationType.purchaseQuoteAccepted,
      productId: null,
      title: copy.title,
      body: copy.body,
      href,
    });
    await this.sendTemplate(params.farmer, 'purchaseQuoteAccepted', {
      name: this.displayName(params.farmer),
      buyerName: params.buyerName,
      title: params.title,
      link: this.appLink(locale, href),
    });
  }

  async notifyPurchaseQuoteDeclined(params: {
    farmer: MailRecipient & { id: string };
    buyerName: string;
    buyerDisplayName?: string | null;
    title: string;
  }): Promise<void> {
    const locale = this.localeOf(params.farmer.locale);
    const href = '/dashboard/quotes';
    const copy = this.purchaseQuoteDeclinedCopy(
      locale,
      this.inAppBuyerLabel(params.buyerDisplayName, locale),
      params.title,
    );
    await this.createUserNotification({
      userId: params.farmer.id,
      type: PrismaUserNotificationType.purchaseQuoteDeclined,
      productId: null,
      title: copy.title,
      body: copy.body,
      href,
    });
    await this.sendTemplate(params.farmer, 'purchaseQuoteDeclined', {
      name: this.displayName(params.farmer),
      buyerName: params.buyerName,
      title: params.title,
      link: this.appLink(locale, href),
    });
  }

  async notifyPurchaseRequestWithdrawn(params: {
    farmer: MailRecipient & { id: string };
    buyerName: string;
    buyerDisplayName?: string | null;
    title: string;
    reason: 'closed' | 'cancelled';
  }): Promise<void> {
    const locale = this.localeOf(params.farmer.locale);
    const href = '/dashboard/quotes';
    const copy =
      params.reason === 'closed'
        ? this.purchaseRequestClosedCopy(
            locale,
            this.inAppBuyerLabel(params.buyerDisplayName, locale),
            params.title,
          )
        : this.purchaseRequestCancelledCopy(
            locale,
            this.inAppBuyerLabel(params.buyerDisplayName, locale),
            params.title,
          );
    await this.createUserNotification({
      userId: params.farmer.id,
      type:
        params.reason === 'closed'
          ? PrismaUserNotificationType.purchaseRequestClosed
          : PrismaUserNotificationType.purchaseRequestCancelled,
      productId: null,
      title: copy.title,
      body: copy.body,
      href,
    });
    await this.sendTemplate(
      params.farmer,
      params.reason === 'closed' ? 'purchaseRequestClosed' : 'purchaseRequestCancelled',
      {
        name: this.displayName(params.farmer),
        buyerName: params.buyerName,
        title: params.title,
        link: this.appLink(locale, href),
      },
    );
  }

  async notifyPurchaseQuoteWithdrawn(params: {
    buyer: MailRecipient & { id: string };
    farmName: string;
    title: string;
    requestId: string;
  }): Promise<void> {
    const locale = this.localeOf(params.buyer.locale);
    const copy = this.purchaseQuoteWithdrawnCopy(locale, params.farmName, params.title);
    await this.createUserNotification({
      userId: params.buyer.id,
      type: PrismaUserNotificationType.purchaseQuoteWithdrawn,
      productId: null,
      title: copy.title,
      body: copy.body,
      href: `/requests/${params.requestId}`,
    });
  }

  async notifyProductApproved(params: {
    farmer: MailRecipient;
    productTitle: string;
    productId: string;
  }): Promise<void> {
    const locale = this.localeOf(params.farmer.locale);
    await this.sendTemplate(params.farmer, 'productApproved', {
      name: this.displayName(params.farmer),
      productTitle: params.productTitle,
      link: this.appLink(locale, `/products/${params.productId}`),
    });
  }

  async notifyProductRejected(params: {
    farmer: MailRecipient;
    productTitle: string;
    productId: string;
    note: string;
  }): Promise<void> {
    const locale = this.localeOf(params.farmer.locale);
    await this.sendTemplate(params.farmer, 'productRejected', {
      name: this.displayName(params.farmer),
      productTitle: params.productTitle,
      note: params.note,
      link: this.appLink(locale, `/dashboard/products/${params.productId}/edit`),
    });
  }

  async notifyProductPendingModeration(params: {
    admin: MailRecipient;
    productTitle: string;
    productId: string;
    sellerName: string;
  }): Promise<void> {
    const locale = this.localeOf(params.admin.locale);
    await this.sendTemplate(params.admin, 'productPendingModeration', {
      name: this.displayName(params.admin),
      productTitle: params.productTitle,
      sellerName: params.sellerName,
      link: this.appLink(
        locale,
        `/dashboard/admin?section=products&status=pending`,
      ),
    });
  }

  /**
   * Admin alert for a producer verification that entered moderation. Carries only data the
   * admin dashboard already shows: never the document, its storage key, or its URL.
   * Resolves to false when delivery failed, so the caller can retry the notification later.
   */
  async notifyVerificationPendingModeration(params: {
    admin: MailRecipient;
    farmId: string;
    farmName: string;
    sellerType: 'privateFarmer' | 'company';
    submittedAt: Date;
  }): Promise<boolean> {
    const locale = this.localeOf(params.admin.locale);
    return this.sendTemplate(params.admin, 'verificationPendingModeration', {
      name: this.displayName(params.admin),
      farmName: params.farmName,
      farmId: params.farmId,
      sellerType: SELLER_TYPE_LABELS[locale][params.sellerType],
      submittedAt: this.formatTimestamp(params.submittedAt, locale),
      link: this.appLink(locale, '/dashboard/admin?section=farms&status=documents'),
    });
  }

  /** Producer email for a verification that a moderator (or the rules) just approved. */
  async notifyVerificationApproved(params: {
    farmer: MailRecipient;
    farmName: string;
  }): Promise<boolean> {
    const locale = this.localeOf(params.farmer.locale);
    return this.sendTemplate(params.farmer, 'verificationApproved', {
      name: this.displayName(params.farmer),
      farmName: params.farmName,
      link: this.appLink(locale, '/dashboard/farm'),
    });
  }

  /**
   * Producer email for a refused verification. The reason arrives as a code and is translated
   * here; a moderator's free-text comment is appended separately and stays as written.
   */
  async notifyVerificationRejected(params: {
    farmer: MailRecipient;
    farmName: string;
    reasonCode: VerificationReasonCode | null;
    moderatorComment: string | null;
  }): Promise<boolean> {
    const locale = this.localeOf(params.farmer.locale);
    const comment = params.moderatorComment?.trim();
    return this.sendTemplate(params.farmer, 'verificationRejected', {
      name: this.displayName(params.farmer),
      farmName: params.farmName,
      reason: VERIFICATION_REASON_LABELS[locale][params.reasonCode ?? 'unspecified'],
      comment: comment ? `\n${MODERATOR_COMMENT_LABELS[locale]}: ${comment}` : '',
      link: this.appLink(locale, '/dashboard/farm'),
    });
  }

  async notifyNewProductListing(params: {
    user: MailRecipient;
    productTitle: string;
    productId: string;
    farmName: string;
    category: string | null;
    region: string | null;
  }): Promise<void> {
    const locale = this.localeOf(params.user.locale);
    await this.sendTemplate(params.user, 'newProductListing', {
      name: this.displayName(params.user),
      productTitle: params.productTitle,
      farmName: params.farmName,
      categoryPart: params.category ? ` · ${params.category}` : '',
      regionPart: params.region ? ` · ${params.region}` : '',
      link: this.appLink(locale, `/products/${params.productId}`),
      settingsLink: this.appLink(locale, '/account/settings#notifications'),
    });
  }

  async notifyNewPurchaseRequest(params: {
    user: MailRecipient;
    title: string;
    requestId: string;
    buyerName: string;
    category: string;
    quantity: string;
    unit: string | null;
  }): Promise<void> {
    const locale = this.localeOf(params.user.locale);
    await this.sendTemplate(params.user, 'newPurchaseRequest', {
      name: this.displayName(params.user),
      title: params.title,
      buyerName: params.buyerName,
      quantity: params.quantity,
      unit: params.unit ? ` ${params.unit}` : '',
      categoryPart: params.category ? ` · ${params.category}` : '',
      link: this.appLink(locale, `/requests/${params.requestId}`),
      settingsLink: this.appLink(locale, '/account/settings#notifications'),
    });
  }

  async notifyVerificationCode(params: {
    user: MailRecipient;
    code: string;
    channel: 'email' | 'sms';
  }): Promise<void> {
    // Do not swallow errors: the caller must know when the code email failed to send.
    const locale = this.localeOf(params.user.locale);
    const rendered = renderEmailTemplate(locale, 'verificationCode', {
      name: this.displayName(params.user),
      code: params.code,
    });
    await this.mail.send({
      to: params.user.email,
      subject: rendered.subject,
      text: rendered.text,
    });
  }

  async notifyAccountDeletionCode(params: {
    user: MailRecipient;
    code: string;
  }): Promise<void> {
    const locale = this.localeOf(params.user.locale);
    const rendered = renderEmailTemplate(locale, 'accountDeletionCode', {
      name: this.displayName(params.user),
      code: params.code,
    });
    await this.mail.send({
      to: params.user.email,
      subject: rendered.subject,
      text: rendered.text,
    });
  }

  async notifyEmailChangeCode(params: {
    user: MailRecipient;
    code: string;
    newEmail: string;
  }): Promise<void> {
    const locale = this.localeOf(params.user.locale);
    const rendered = renderEmailTemplate(locale, 'emailChangeCode', {
      name: this.displayName(params.user),
      code: params.code,
      newEmail: params.newEmail,
    });
    await this.mail.send({
      to: params.user.email,
      subject: rendered.subject,
      text: rendered.text,
    });
  }

  async notifyPasswordReset(params: {
    email: string;
    locale: string;
    displayName: string | null;
    rawToken: string;
    expiresMinutes: number;
  }): Promise<void> {
    const locale = this.localeOf(params.locale);
    const link = this.appLink(
      locale,
      `/reset-password?token=${encodeURIComponent(params.rawToken)}`,
    );
    await this.sendTemplate(
      { email: params.email, locale, displayName: params.displayName },
      'passwordReset',
      {
        name: this.displayName(params),
        link,
        expiresMinutes: String(params.expiresMinutes),
      },
    );
  }

  async notifyHarvestAvailable(params: {
    user: MailRecipient & { id: string };
    productId: string;
    productTitle: string;
    farmName: string;
    harvestStatus: string;
  }): Promise<void> {
    const locale = this.localeOf(params.user.locale);
    const localizedTitle = localizeProductTitle(params.productTitle, locale);
    const statusLabel = this.harvestStatusLabel(params.harvestStatus, locale);
    const href = `/products/${params.productId}`;

    await this.createUserNotification({
      userId: params.user.id,
      type: PrismaUserNotificationType.harvestAvailable,
      productId: params.productId,
      title: localizedTitle,
      body: this.harvestAvailableBody(locale, params.farmName, statusLabel),
      href,
    });

    await this.sendTemplate(params.user, 'harvestAvailable', {
      name: this.displayName(params.user),
      productTitle: params.productTitle,
      farmName: params.farmName,
      statusLabel,
      link: this.appLink(locale, href),
    });
  }

  async notifyHarvestPreorderOpen(params: {
    user: MailRecipient & { id: string };
    productId: string;
    productTitle: string;
    farmName: string;
  }): Promise<void> {
    const locale = this.localeOf(params.user.locale);
    const localizedTitle = localizeProductTitle(params.productTitle, locale);
    const href = `/products/${params.productId}`;

    await this.createUserNotification({
      userId: params.user.id,
      type: PrismaUserNotificationType.harvestPreorderOpen,
      productId: params.productId,
      title: localizedTitle,
      body: this.harvestPreorderBody(locale, params.farmName),
      href,
    });

    await this.sendTemplate(params.user, 'harvestPreorderOpen', {
      name: this.displayName(params.user),
      productTitle: params.productTitle,
      farmName: params.farmName,
      link: this.appLink(locale, href),
    });
  }

  async listMine(userId: string, limit = 30): Promise<UserNotificationItem[]> {
    try {
      const rows = await this.prisma.userNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(limit, 1), 100),
      });
      return rows.map((row) => ({
        id: row.id,
        type: row.type,
        productId: row.productId,
        title: row.title,
        body: row.body,
        href: row.href,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      }));
    } catch (error) {
      this.logger.error(
        `Failed to list notifications for ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
      return [];
    }
  }

  async markRead(userId: string, id: string): Promise<UserNotificationItem | null> {
    const existing = await this.prisma.userNotification.findFirst({
      where: { id, userId },
    });
    if (!existing) return null;
    if (existing.readAt) {
      return {
        id: existing.id,
        type: existing.type,
        productId: existing.productId,
        title: existing.title,
        body: existing.body,
        href: existing.href,
        readAt: existing.readAt.toISOString(),
        createdAt: existing.createdAt.toISOString(),
      };
    }
    const updated = await this.prisma.userNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return {
      id: updated.id,
      type: updated.type,
      productId: updated.productId,
      title: updated.title,
      body: updated.body,
      href: updated.href,
      readAt: updated.readAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async markAllRead(userId: string): Promise<{ ok: true }> {
    await this.prisma.userNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markTypesRead(
    userId: string,
    types: readonly string[],
  ): Promise<{ updated: number }> {
    const allowed = [...new Set(types.filter(isUserNotificationType))];
    if (allowed.length === 0) {
      return { updated: 0 };
    }
    const result = await this.prisma.userNotification.updateMany({
      where: {
        userId,
        readAt: null,
        type: { in: allowed as PrismaUserNotificationType[] },
      },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async unreadSummary(userId: string): Promise<NotificationUnreadSummary> {
    try {
      const groups = await this.prisma.userNotification.groupBy({
        by: ['type'],
        where: { userId, readAt: null },
        _count: { _all: true },
      });
      return summarizeUnreadByType(
        groups.map((group) => ({ type: group.type, count: group._count._all })),
      );
    } catch (error) {
      this.logger.error(
        `Failed to summarize unread notifications for ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
      return { ...EMPTY_NOTIFICATION_UNREAD_SUMMARY };
    }
  }

  async unreadCount(userId: string): Promise<number> {
    return (await this.unreadSummary(userId)).totalUnread;
  }

  async notifyChatMessage(params: {
    recipient: MailRecipient;
    senderName: string;
    preview: string;
    conversationId: string;
  }): Promise<void> {
    const locale = this.localeOf(params.recipient.locale);
    await this.sendTemplate(params.recipient, 'chatMessage', {
      name: this.displayName(params.recipient),
      senderName: params.senderName,
      preview: params.preview,
      link: this.appLink(locale, `/dashboard/chat/${params.conversationId}`),
    });
  }

  private async createUserNotification(params: {
    userId: string;
    type: PrismaUserNotificationType;
    productId: string | null;
    title: string;
    body: string;
    href: string;
  }): Promise<void> {
    try {
      await this.prisma.userNotification.create({
        data: {
          userId: params.userId,
          type: params.type,
          productId: params.productId,
          title: params.title,
          body: params.body,
          href: params.href,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create in-app notification for ${params.userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private formatTimestamp(value: Date, locale: Locale): string {
    return `${new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(value)} UTC`;
  }

  private harvestStatusLabel(status: string, locale: Locale): string {
    if (isHarvestStatus(status)) {
      return HARVEST_STATUS_LABELS[locale][status] ?? status;
    }
    return status;
  }

  private inAppBuyerLabel(displayName: string | null | undefined, locale: Locale): string {
    const name = displayName?.trim();
    if (name) {
      return name;
    }
    switch (locale) {
      case 'ru':
        return 'Покупатель';
      case 'ka':
        return 'მყიდველი';
      case 'de':
        return 'Ein Käufer';
      case 'fr':
        return 'Un acheteur';
      case 'it':
        return 'Un acquirente';
      case 'es':
        return 'Un comprador';
      default:
        return 'A buyer';
    }
  }

  private purchaseQuoteReceivedCopy(
    locale: Locale,
    farmName: string,
    title: string,
  ): { title: string; body: string } {
    switch (locale) {
      case 'ru':
        return {
          title: 'Новое предложение',
          body: `${farmName} отправил(а) предложение по вашему запросу на покупку «${title}».`,
        };
      case 'ka':
        return {
          title: 'ახალი შეთავაზება',
          body: `${farmName} გამოგიგზავნათ შეთავაზება თქვენს შესყიდვის მოთხოვნაზე «${title}».`,
        };
      case 'de':
        return {
          title: 'Neues Angebot erhalten',
          body: `${farmName} hat ein Angebot zu Ihrer Kaufanfrage „${title}“ gesendet.`,
        };
      case 'fr':
        return {
          title: 'Nouvelle offre reçue',
          body: `${farmName} a envoyé une offre pour votre demande d’achat « ${title} ».`,
        };
      case 'it':
        return {
          title: 'Nuova offerta ricevuta',
          body: `${farmName} ha inviato un’offerta per la tua richiesta di acquisto «${title}».`,
        };
      case 'es':
        return {
          title: 'Nueva oferta recibida',
          body: `${farmName} envió una oferta para tu solicitud de compra «${title}».`,
        };
      default:
        return {
          title: 'New quote received',
          body: `${farmName} sent a quote for your purchase request “${title}”.`,
        };
    }
  }

  private purchaseQuoteAcceptedCopy(
    locale: Locale,
    buyerName: string,
    title: string,
  ): { title: string; body: string } {
    switch (locale) {
      case 'ru':
        return {
          title: 'Ваше предложение принято',
          body: `${buyerName} принял(а) ваше предложение по запросу на покупку «${title}».`,
        };
      case 'ka':
        return {
          title: 'თქვენი შეთავაზება მიღებულია',
          body: `${buyerName} მიიღო თქვენი შეთავაზება შესყიდვის მოთხოვნაზე «${title}».`,
        };
      case 'de':
        return {
          title: 'Ihr Angebot wurde angenommen',
          body: `${buyerName} hat Ihr Angebot zur Kaufanfrage „${title}“ angenommen.`,
        };
      case 'fr':
        return {
          title: 'Votre offre a été acceptée',
          body: `${buyerName} a accepté votre offre pour la demande d’achat « ${title} ».`,
        };
      case 'it':
        return {
          title: 'La tua offerta è stata accettata',
          body: `${buyerName} ha accettato la tua offerta per la richiesta di acquisto «${title}».`,
        };
      case 'es':
        return {
          title: 'Tu oferta fue aceptada',
          body: `${buyerName} aceptó tu oferta para la solicitud de compra «${title}».`,
        };
      default:
        return {
          title: 'Your quote was accepted',
          body: `${buyerName} accepted your quote for the purchase request “${title}”.`,
        };
    }
  }

  private purchaseQuoteDeclinedCopy(
    locale: Locale,
    buyerName: string,
    title: string,
  ): { title: string; body: string } {
    switch (locale) {
      case 'ru':
        return {
          title: 'Ваше предложение не выбрано',
          body: `${buyerName} не выбрал(а) ваше предложение по запросу на покупку «${title}». Откройте «Мои предложения».`,
        };
      case 'ka':
        return {
          title: 'თქვენი შეთავაზება არ შეირჩა',
          body: `${buyerName} არ შეარჩია თქვენი შეთავაზება შესყიდვის მოთხოვნაზე «${title}».`,
        };
      case 'de':
        return {
          title: 'Ihr Angebot wurde nicht ausgewählt',
          body: `${buyerName} hat Ihr Angebot zur Kaufanfrage „${title}“ nicht ausgewählt.`,
        };
      case 'fr':
        return {
          title: 'Votre offre n’a pas été retenue',
          body: `${buyerName} n’a pas retenu votre offre pour la demande d’achat « ${title} ».`,
        };
      case 'it':
        return {
          title: 'La tua offerta non è stata scelta',
          body: `${buyerName} non ha scelto la tua offerta per la richiesta di acquisto «${title}».`,
        };
      case 'es':
        return {
          title: 'Tu oferta no fue seleccionada',
          body: `${buyerName} no seleccionó tu oferta para la solicitud de compra «${title}».`,
        };
      default:
        return {
          title: 'Your quote was not selected',
          body: `${buyerName} did not select your quote for the purchase request “${title}”.`,
        };
    }
  }

  private purchaseRequestClosedCopy(
    locale: Locale,
    buyerName: string,
    title: string,
  ): { title: string; body: string } {
    switch (locale) {
      case 'ru':
        return {
          title: 'Запрос на покупку закрыт',
          body: `${buyerName} закрыл(а) запрос на покупку «${title}», ваше предложение больше не рассматривается. Откройте «Мои предложения».`,
        };
      case 'ka':
        return {
          title: 'შესყიდვის მოთხოვნა დაიხურა',
          body: `${buyerName} დახურა შესყიდვის მოთხოვნა «${title}», ამიტომ თქვენი შეთავაზება აღარ განიხილება.`,
        };
      case 'de':
        return {
          title: 'Kaufanfrage geschlossen',
          body: `${buyerName} hat die Kaufanfrage „${title}“ geschlossen. Ihr Angebot wird nicht mehr geprüft.`,
        };
      case 'fr':
        return {
          title: 'Demande d’achat clôturée',
          body: `${buyerName} a clôturé la demande d’achat « ${title} », votre offre n’est plus examinée.`,
        };
      case 'it':
        return {
          title: 'Richiesta di acquisto chiusa',
          body: `${buyerName} ha chiuso la richiesta di acquisto «${title}», la tua offerta non è più in esame.`,
        };
      case 'es':
        return {
          title: 'Solicitud de compra cerrada',
          body: `${buyerName} cerró la solicitud de compra «${title}», tu oferta ya no se considera.`,
        };
      default:
        return {
          title: 'Purchase request closed',
          body: `${buyerName} closed the purchase request “${title}”, so your quote is no longer under consideration.`,
        };
    }
  }

  private purchaseRequestCancelledCopy(
    locale: Locale,
    buyerName: string,
    title: string,
  ): { title: string; body: string } {
    switch (locale) {
      case 'ru':
        return {
          title: 'Запрос на покупку отменён',
          body: `${buyerName} отменил(а) запрос на покупку «${title}», ваше предложение больше не рассматривается. Откройте «Мои предложения».`,
        };
      case 'ka':
        return {
          title: 'შესყიდვის მოთხოვნა გაუქმდა',
          body: `${buyerName} გააუქმა შესყიდვის მოთხოვნა «${title}», ამიტომ თქვენი შეთავაზება აღარ განიხილება.`,
        };
      case 'de':
        return {
          title: 'Kaufanfrage storniert',
          body: `${buyerName} hat die Kaufanfrage „${title}“ storniert. Ihr Angebot wird nicht mehr geprüft.`,
        };
      case 'fr':
        return {
          title: 'Demande d’achat annulée',
          body: `${buyerName} a annulé la demande d’achat « ${title} », votre offre n’est plus examinée.`,
        };
      case 'it':
        return {
          title: 'Richiesta di acquisto annullata',
          body: `${buyerName} ha annullato la richiesta di acquisto «${title}», la tua offerta non è più in esame.`,
        };
      case 'es':
        return {
          title: 'Solicitud de compra cancelada',
          body: `${buyerName} canceló la solicitud de compra «${title}», tu oferta ya no se considera.`,
        };
      default:
        return {
          title: 'Purchase request cancelled',
          body: `${buyerName} cancelled the purchase request “${title}”, so your quote is no longer under consideration.`,
        };
    }
  }

  private purchaseQuoteWithdrawnCopy(
    locale: Locale,
    farmName: string,
    title: string,
  ): { title: string; body: string } {
    switch (locale) {
      case 'ru':
        return {
          title: 'Предложение отозвано',
          body: `${farmName} отозвал(а) предложение по вашему запросу на покупку «${title}».`,
        };
      case 'ka':
        return {
          title: 'შეთავაზება გაუქმდა',
          body: `${farmName} გაიხმო შეთავაზება თქვენი შესყიდვის მოთხოვნიდან «${title}».`,
        };
      case 'de':
        return {
          title: 'Angebot zurückgezogen',
          body: `${farmName} hat ein Angebot zu Ihrer Kaufanfrage „${title}“ zurückgezogen.`,
        };
      case 'fr':
        return {
          title: 'Offre retirée',
          body: `${farmName} a retiré une offre de votre demande d’achat « ${title} ».`,
        };
      case 'it':
        return {
          title: 'Offerta ritirata',
          body: `${farmName} ha ritirato un’offerta dalla tua richiesta di acquisto «${title}».`,
        };
      case 'es':
        return {
          title: 'Oferta retirada',
          body: `${farmName} retiró una oferta de tu solicitud de compra «${title}».`,
        };
      default:
        return {
          title: 'A quote was withdrawn',
          body: `${farmName} withdrew a quote from your purchase request “${title}”.`,
        };
    }
  }

  private harvestAvailableBody(locale: Locale, farmName: string, statusLabel: string): string {
    switch (locale) {
      case 'ru':
        return `${farmName}: урожай теперь «${statusLabel}».`;
      case 'ka':
        return `${farmName}: მოსავალი ახლა «${statusLabel}».`;
      case 'de':
        return `${farmName}: Ernte ist jetzt ${statusLabel}.`;
      case 'fr':
        return `${farmName} : la récolte est maintenant ${statusLabel}.`;
      case 'it':
        return `${farmName}: il raccolto ora è ${statusLabel}.`;
      case 'es':
        return `${farmName}: la cosecha ahora está ${statusLabel}.`;
      default:
        return `${farmName}: harvest is now ${statusLabel}.`;
    }
  }

  private harvestPreorderBody(locale: Locale, farmName: string): string {
    switch (locale) {
      case 'ru':
        return `${farmName}: открыт предзаказ.`;
      case 'ka':
        return `${farmName}: გაიხსნა წინასწარი შეკვეთა.`;
      case 'de':
        return `${farmName}: Vorverkauf ist geöffnet.`;
      case 'fr':
        return `${farmName} : précommandes ouvertes.`;
      case 'it':
        return `${farmName}: preordini aperti.`;
      case 'es':
        return `${farmName}: preventa abierta.`;
      default:
        return `${farmName}: pre-orders are now open.`;
    }
  }

  /** Resolves to true when the message left the mail driver, false when delivery failed. */
  private async sendTemplate(
    recipient: MailRecipient,
    key: Parameters<typeof renderEmailTemplate>[1],
    vars: Record<string, string>,
  ): Promise<boolean> {
    try {
      const locale = this.localeOf(recipient.locale);
      const localizedVars =
        'productTitle' in vars
          ? {
              ...vars,
              productTitle: localizeProductTitle(vars.productTitle, locale),
            }
          : vars;
      const rendered = renderEmailTemplate(locale, key, localizedVars);
      await this.mail.send({
        to: recipient.email,
        subject: rendered.subject,
        text: rendered.text,
      });
      return true;
    } catch (error) {
      // Best-effort: do not rethrow. Callers that must fail closed (verification,
      // email change, deletion) invoke MailService.send directly instead.
      this.logger.error(
        `Failed to send ${key} email to ${recipient.email} detail=${sanitizeMailError(error)}`,
      );
      return false;
    }
  }

  private localeOf(value: string): Locale {
    return isLocale(value) ? value : DEFAULT_LOCALE;
  }

  private displayName(user: { displayName?: string | null; email?: string }): string {
    return user.displayName?.trim() || user.email || 'there';
  }

  private appLink(locale: Locale, path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${this.webPublicUrl}/${locale}${normalized}`;
  }
}
