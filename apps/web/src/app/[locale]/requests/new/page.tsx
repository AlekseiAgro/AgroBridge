import { getTranslations, setRequestLocale } from 'next-intl/server';
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
  if (!user) redirect({ href: '/login', locale });
  if (user!.role !== 'buyer' && user!.role !== 'admin') {
    redirect({ href: '/requests', locale });
  }

  const t = await getTranslations('purchaseRequests');

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main narrow">
        <p className="eyebrow">
          <Link href="/requests">{t('boardTitle')}</Link>
        </p>
        <h1>{t('createTitle')}</h1>
        <p className="page__subtitle">{t('createSubtitle')}</p>
        <PurchaseRequestForm />
      </main>
      <SiteFooter />
    </div>
  );
}
