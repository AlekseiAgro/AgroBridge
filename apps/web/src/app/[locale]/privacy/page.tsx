import { getTranslations } from 'next-intl/server';
import { legalPrivacyContent } from '@/content/legal';
import { LegalPublicPage, legalContentLocale } from '@/components/LegalPublicPage';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const legalLocale = legalContentLocale(locale);
  const t = await getTranslations('legal');
  const content = legalLocale ? legalPrivacyContent(legalLocale) : null;

  return (
    <LegalPublicPage
      locale={locale}
      kind="privacy"
      title={content?.title ?? t('privacyTitle')}
      version={content?.version}
      placeholder={content?.placeholder ?? t('placeholderBanner')}
      paragraphs={content?.paragraphs ?? []}
    />
  );
}
