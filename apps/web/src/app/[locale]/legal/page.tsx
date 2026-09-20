import { getTranslations } from 'next-intl/server';
import { legalInformationContent } from '@/content/legal';
import { LegalPublicPage, legalContentLocale } from '@/components/LegalPublicPage';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LegalInformationPage({ params }: Props) {
  const { locale } = await params;
  const legalLocale = legalContentLocale(locale);
  const t = await getTranslations('legal');
  const content = legalLocale ? legalInformationContent(legalLocale) : null;

  return (
    <LegalPublicPage
      locale={locale}
      kind="information"
      title={content?.title ?? t('informationTitle')}
      paragraphs={content?.paragraphs ?? []}
    />
  );
}
