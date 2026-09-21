import { canTrade } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PurchaseRequestForm } from '@/components/PurchaseRequestForm';
import { redirect } from '@/i18n/navigation';
import { requireVerifiedUser } from '@/lib/require-verified-user';
import { noindexRobots } from '@/lib/seo-robots';

export const metadata = {
  robots: noindexRobots,
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NewPurchaseRequestPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireVerifiedUser(locale, '/requests/new');

  const t = await getTranslations('purchaseRequests');

  if (!canTrade(user.role)) {
    redirect({ href: '/account', locale });
  }

  return (
    <main className="page__main narrow">
        <h1>{t('createTitle')}</h1>
        <p className="page__subtitle">{t('createSubtitle')}</p>
        <PurchaseRequestForm />
    </main>
  );
}
