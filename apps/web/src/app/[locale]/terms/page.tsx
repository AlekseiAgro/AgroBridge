import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LegalPublicPage } from '@/components/LegalPublicPage';
import { staticPublicMetadata } from '@/lib/seo-public-metadata';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return staticPublicMetadata(locale, 'terms');
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPublicPage locale={locale} kind="terms" />;
}
