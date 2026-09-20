import { getTranslations } from 'next-intl/server';
import { legalTermsContent } from '@/content/legal';
import { LegalPublicPage, legalContentLocale } from '@/components/LegalPublicPage';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  const legalLocale = legalContentLocale(locale);
  const t = await getTranslations('legal');
  const content = legalLocale ? legalTermsContent(legalLocale) : null;

  return (
    <LegalPublicPage
      locale={locale}
      kind="terms"
      title={content?.title ?? t('termsTitle')}
      version={content?.version}
      placeholder={content?.placeholder ?? t('placeholderBanner')}
      paragraphs={content?.paragraphs ?? []}
    />
  );
}
