import type { RfqSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { RfqActionButton } from '@/components/RfqActionButton';
import { SiteHeader } from '@/components/SiteHeader';
import { Link, redirect } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function BuyerRfqDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (user!.role !== 'buyer' && user!.role !== 'admin') {
    redirect({ href: '/account', locale });
  }

  const t = await getTranslations('rfq');
  const tp = await getTranslations('product');

  let rfq: RfqSummary;
  try {
    rfq = await apiRequestAuthed<RfqSummary>(`/rfqs/${id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main narrow">
        <p className="eyebrow">
          <Link href="/dashboard/rfqs">{t('mineTitle')}</Link>
        </p>
        <h1>{rfq.product.title}</h1>
        <p className="page__subtitle">
          {t(`statuses.${rfq.status}`)} · {rfq.farm.name}
        </p>

        <dl className="account-details">
          <div>
            <dt>{t('quantity')}</dt>
            <dd>
              {rfq.quantity}
              {rfq.unit ? ` ${tp(`units.${rfq.unit as 'kg'}`)}` : ''}
            </dd>
          </div>
          {rfq.message ? (
            <div>
              <dt>{t('message')}</dt>
              <dd>{rfq.message}</dd>
            </div>
          ) : null}
          {rfq.offer ? (
            <>
              <div>
                <dt>{t('price')}</dt>
                <dd>
                  {rfq.offer.priceAmount} {rfq.offer.currency}
                </dd>
              </div>
              {rfq.offer.message ? (
                <div>
                  <dt>{t('farmerMessage')}</dt>
                  <dd>{rfq.offer.message}</dd>
                </div>
              ) : null}
            </>
          ) : null}
        </dl>

        <div className="home__actions" style={{ marginTop: '1.25rem' }}>
          {rfq.status === 'pending' ? (
            <RfqActionButton rfqId={rfq.id} action="cancel" />
          ) : null}
          {rfq.status === 'offered' ? (
            <>
              <RfqActionButton rfqId={rfq.id} action="accept" variant="primary" />
              <RfqActionButton rfqId={rfq.id} action="decline" />
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
