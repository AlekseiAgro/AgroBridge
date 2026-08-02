import { SUPPORT_EMAIL } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { SupportForm } from '@/components/SupportForm';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SupportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('support');
  const user = await getCurrentUser();

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main narrow">
        <h1>{t('title')}</h1>
        <p className="page__subtitle">{t('subtitle')}</p>

        <div className="support-email">
          <p className="support-email__label">{t('emailLabel')}</p>
          <a className="support-email__value" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          <p className="support-email__hint">{t('emailHint')}</p>
        </div>

        <SupportForm
          defaultName={user?.displayName ?? ''}
          defaultEmail={user?.email ?? ''}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
