import { isLegalLocale, type LegalLocale } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { LegalLocaleChooser } from '@/components/LegalLocaleChooser';

type DocumentKind = 'information' | 'terms' | 'privacy';

type Props = {
  locale: string;
  kind: DocumentKind;
  title: string;
  version?: string;
  placeholder?: string;
  paragraphs: string[];
};

const HREF: Record<DocumentKind, '/legal' | '/terms' | '/privacy'> = {
  information: '/legal',
  terms: '/terms',
  privacy: '/privacy',
};

export async function LegalPublicPage({
  locale,
  kind,
  title,
  version,
  placeholder,
  paragraphs,
}: Props) {
  setRequestLocale(locale);
  const t = await getTranslations('legal');

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main narrow legal-page">
        {isLegalLocale(locale) ? (
          <>
            <h1>{title}</h1>
            {version ? <p className="page__subtitle">{t('version', { version })}</p> : null}
            {placeholder ? <p className="legal-page__placeholder">{placeholder}</p> : null}
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </>
        ) : (
          <>
            <h1>{title}</h1>
            <LegalLocaleChooser href={HREF[kind]} />
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export function legalContentLocale(locale: string): LegalLocale | null {
  return isLegalLocale(locale) ? locale : null;
}
