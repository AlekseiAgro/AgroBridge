import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserNotificationType as PrismaUserNotificationType } from '@prisma/client';
import type { Locale } from '@agrobridge/shared';
import {
  DEFAULT_LOCALE,
  isHarvestStatus,
  isLocale,
  localizeProductTitle,
  type UserNotificationItem,
} from '@agrobridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { renderEmailTemplate } from './email-templates';
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
      settingsLink: this.appLink(locale, '/dashboard/subscriptions'),
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
      settingsLink: this.appLink(locale, '/dashboard/subscriptions'),
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

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.userNotification.count({
      where: { userId, readAt: null },
    });
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

  private harvestStatusLabel(status: string, locale: Locale): string {
    if (isHarvestStatus(status)) {
      return HARVEST_STATUS_LABELS[locale][status] ?? status;
    }
    return status;
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

  private async sendTemplate(
    recipient: MailRecipient,
    key: Parameters<typeof renderEmailTemplate>[1],
    vars: Record<string, string>,
  ): Promise<void> {
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
    } catch (error) {
      this.logger.error(
        `Failed to send ${key} email to ${recipient.email}`,
        error instanceof Error ? error.stack : String(error),
      );
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
