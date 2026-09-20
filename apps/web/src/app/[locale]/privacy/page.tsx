import { setRequestLocale } from 'next-intl/server';
import { LegalPublicPage } from '@/components/LegalPublicPage';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPublicPage locale={locale} kind="privacy" />;
}
