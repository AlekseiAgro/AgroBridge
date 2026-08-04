import type { AlertSubscription, HarvestWatchItem } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ActiveAlertSubscriptions } from '@/components/ActiveAlertSubscriptions';
import { AlertSubscriptionForm } from '@/components/AlertSubscriptionForm';
import { HarvestWatchesList } from '@/components/HarvestWatchesList';
import { redirect } from '@/i18n/navigation';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SubscriptionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale });
  }

  const t = await getTranslations('subscriptions');
  const [subscription, watches] = await Promise.all([
    apiRequestAuthed<AlertSubscription>('/subscriptions/alerts'),
    apiRequestAuthed<HarvestWatchItem[]>('/products/watches'),
  ]);

  return (
    <main className="cabinet-page cabinet-page--narrow">
      <h1>{t('title')}</h1>
      <p className="page__subtitle">{t('subtitle')}</p>

      <section className="cabinet-section">
        <h2 className="section-title">{t('activeTitle')}</h2>
        <p className="page__subtitle">{t('activeHint')}</p>
        <ActiveAlertSubscriptions subscription={subscription} />
      </section>

      <section className="cabinet-section cabinet-section--nested">
        <h2 className="section-title">{t('harvestWatchesTitle')}</h2>
        <p className="page__subtitle">{t('harvestWatchesHint')}</p>
        <HarvestWatchesList initial={watches} />
      </section>

      <section className="cabinet-section cabinet-section--nested">
        <h2 className="section-title">{t('settingsTitle')}</h2>
        <p className="page__subtitle">{t('settingsHint')}</p>
        <AlertSubscriptionForm initial={subscription} />
      </section>
    </main>
  );
}
