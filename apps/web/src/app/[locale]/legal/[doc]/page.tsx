import {
  LEGAL_DOC_SLUGS,
  SUPPORT_EMAIL,
  isLegalDocSlug,
  type LegalDocSlug,
} from '@agrobridge/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LegalDocument } from '@/components/LegalDocument';
import { LegalNav } from '@/components/LegalNav';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import type { LegalDocContent } from '@/lib/legal';

type Props = {
  params: Promise<{ locale: string; doc: string }>;
};

export function generateStaticParams() {
  return LEGAL_DOC_SLUGS.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!isLegalDocSlug(doc)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: 'legal' });
  const content = t.raw(`docs.${doc}`) as LegalDocContent;
  return {
    title: `${content.title} · AgroBridge`,
    description: content.description,
  };
}

export default async function LegalDocPage({ params }: Props) {
  const { locale, doc } = await params;
  setRequestLocale(locale);

  if (!isLegalDocSlug(doc)) {
    notFound();
  }

  const t = await getTranslations('legal');
  const tf = await getTranslations('footer');
  const content = t.raw(`docs.${doc}`) as LegalDocContent;
  const labels = Object.fromEntries(
    LEGAL_DOC_SLUGS.map((slug) => [slug, (t.raw(`docs.${slug}`) as LegalDocContent).title]),
  ) as Record<LegalDocSlug, string>;

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main legal-page">
        <LegalNav labels={labels} current={doc} navLabel={t('nav')} />
        <h1>{content.title}</h1>
        <p className="page__subtitle">{t('updatedLabel', { date: t('updatedDate') })}</p>
        <p className="legal-page__operator">{t('operator')}</p>
        <p className="legal-page__operator">{t('contactLead', { email: SUPPORT_EMAIL })}</p>
        <LegalDocument doc={content} supportLabel={tf('support')} vars={{ email: SUPPORT_EMAIL }} />
      </main>
      <SiteFooter />
    </div>
  );
}
