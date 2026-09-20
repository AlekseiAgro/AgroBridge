import type { LegalLocale } from '@agrobridge/shared';
import { LEGAL_INFORMATION_EN } from './information.en';
import { LEGAL_INFORMATION_KA } from './information.ka';
import { LEGAL_PRIVACY_EN } from './privacy.en';
import { LEGAL_PRIVACY_KA } from './privacy.ka';
import { LEGAL_TERMS_EN } from './terms.en';
import { LEGAL_TERMS_KA } from './terms.ka';

export type LegalInfoContent = {
  title: string;
  versionLabel: string;
  paragraphs: string[];
};

export type LegalPlaceholderContent = {
  title: string;
  version: string;
  placeholder: string;
  paragraphs: string[];
};

export function legalInformationContent(locale: LegalLocale): LegalInfoContent {
  return locale === 'ka' ? LEGAL_INFORMATION_KA : LEGAL_INFORMATION_EN;
}

export function legalTermsContent(locale: LegalLocale): LegalPlaceholderContent {
  return locale === 'ka' ? LEGAL_TERMS_KA : LEGAL_TERMS_EN;
}

export function legalPrivacyContent(locale: LegalLocale): LegalPlaceholderContent {
  return locale === 'ka' ? LEGAL_PRIVACY_KA : LEGAL_PRIVACY_EN;
}
