import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LogoutButton } from '@/components/LogoutButton';
import { PurchaseRequestForm } from '@/components/PurchaseRequestForm';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { Link, redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NewPurchaseRequestPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login?next=/requests/new', locale });
  }

  const t = await getTranslations('purchaseRequests');
  const tn = await getTranslations('nav');
  const canCreate = user!.role === 'buyer' || user!.role === 'admin';

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main narrow">
        <p className="eyebrow">
          <Link href="/buyers">{tn('forBuyers')}</Link>
          {' · '}
          <Link href="/requests">{t('boardTitle')}</Link>
        </p>
        <h1>{t('createTitle')}</h1>
        <p className="page__subtitle">{t('createSubtitle')}</p>
        {canCreate ? (
          <PurchaseRequestForm />
        ) : (
          <div className="auth-card" style={{ marginTop: '1.25rem' }}>
            <p>{t('buyerOnly')}</p>
            <div className="how-it-works__actions" style={{ marginTop: '1rem' }}>
              <LogoutButton redirectTo="/register?next=/requests/new" />
              <Link href="/register?next=/requests/new" className="button button--primary">
                {t('registerAsBuyer')}
              </Link>
              <Link href="/requests" className="button button--ghost">
                {t('boardTitle')}
              </Link>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
