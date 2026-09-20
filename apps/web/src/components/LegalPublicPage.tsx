import { setRequestLocale } from 'next-intl/server';
import type { LegalDocumentKind } from '@/content/legal';
import { LegalDocumentPanel } from '@/components/LegalDocumentPanel';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';

type Props = {
  locale: string;
  kind: LegalDocumentKind;
};

export async function LegalPublicPage({ locale, kind }: Props) {
  setRequestLocale(locale);

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main narrow legal-page">
        <LegalDocumentPanel uiLocale={locale} kind={kind} />
      </main>
      <SiteFooter />
    </div>
  );
}
