import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Locale } from '@agrobridge/shared';
import { DEFAULT_LOCALE, isLocale, localizeProductTitle } from '@agrobridge/shared';
import { renderEmailTemplate } from './email-templates';
import { MailService } from './mail.service';
import type { MailRecipient } from './mail.types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly webPublicUrl: string;

  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
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
      link: this.appLink(locale, '/account'),
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
    await this.sendTemplate(params.user, 'verificationCode', {
      name: this.displayName(params.user),
      code: params.code,
    });
  }

  async notifyHarvestAvailable(params: {
    user: MailRecipient;
    productId: string;
    productTitle: string;
    farmName: string;
    harvestStatus: string;
  }): Promise<void> {
    const locale = this.localeOf(params.user.locale);
    await this.sendTemplate(params.user, 'harvestAvailable', {
      name: this.displayName(params.user),
      productTitle: params.productTitle,
      farmName: params.farmName,
      statusLabel: params.harvestStatus,
      link: this.appLink(locale, `/products/${params.productId}`),
    });
  }

  async notifyHarvestPreorderOpen(params: {
    user: MailRecipient;
    productId: string;
    productTitle: string;
    farmName: string;
  }): Promise<void> {
    const locale = this.localeOf(params.user.locale);
    await this.sendTemplate(params.user, 'harvestPreorderOpen', {
      name: this.displayName(params.user),
      productTitle: params.productTitle,
      farmName: params.farmName,
      link: this.appLink(locale, `/products/${params.productId}`),
    });
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
