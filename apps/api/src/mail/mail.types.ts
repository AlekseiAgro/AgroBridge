import type { Locale } from '@agrobridge/shared';

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export type MailRecipient = {
  email: string;
  locale: Locale | string;
  displayName?: string | null;
};

export type EmailTemplateKey =
  | 'welcome'
  | 'rfqCreated'
  | 'rfqOfferCreated'
  | 'rfqAccepted'
  | 'rfqDeclinedByBuyer'
  | 'rfqDeclinedByFarmer'
  | 'rfqCancelled'
  | 'productApproved'
  | 'productRejected'
  | 'newProductListing'
  | 'newPurchaseRequest'
  | 'verificationCode';
