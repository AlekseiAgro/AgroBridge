import { LEGAL_DOC_SLUGS, SUPPORT_EMAIL, type LegalDocSlug } from '@agrobridge/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import type { LegalDocContent } from '@/lib/legal';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });
  return {
    title: `${t('indexTitle')} · AgroBridge`,
    description: t('indexSubtitle'),
  };
}

export default async function LegalIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('legal');

  const docs = LEGAL_DOC_SLUGS.map((slug) => {
    const content = t.raw(`docs.${slug}`) as LegalDocContent;
    return { slug: slug as LegalDocSlug, title: content.title, description: content.description };
  });

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main legal-page">
        <h1>{t('indexTitle')}</h1>
        <p className="page__subtitle">{t('indexSubtitle')}</p>
        <p className="legal-page__operator">{t('operator')}</p>
        <p className="legal-page__operator">{t('contactLead', { email: SUPPORT_EMAIL })}</p>
        <ul className="legal-index">
          {docs.map((doc) => (
            <li key={doc.slug}>
              <Link href={`/legal/${doc.slug}`}>{doc.title}</Link>
              <p>{doc.description}</p>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
