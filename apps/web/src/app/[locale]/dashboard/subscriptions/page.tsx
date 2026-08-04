import type {
  AlertSubscription,
  HarvestWatchItem,
  UserNotificationItem,
} from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ActiveAlertSubscriptions } from '@/components/ActiveAlertSubscriptions';
import { AlertSubscriptionForm } from '@/components/AlertSubscriptionForm';
import { HarvestWatchesList } from '@/components/HarvestWatchesList';
import { UserNotificationsList } from '@/components/UserNotificationsList';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { requireVerifiedUser } from '@/lib/require-verified-user';
import { apiRequestAuthed } from '@/lib/server-api';

type Props = {
  params: Promise<{ locale: string }>;
};

async function loadOptional<T>(path: string, fallback: T): Promise<{ data: T; error: string | null }> {
  try {
    const data = await apiRequestAuthed<T>(path);
    return { data, error: null };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Request failed';
    return { data: fallback, error: message };
  }
}

export default async function SubscriptionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireVerifiedUser(locale, '/dashboard/subscriptions');

  const t = await getTranslations('subscriptions');

  const [subscriptionResult, watchesResult, inboxResult] = await Promise.all([
    loadOptional<AlertSubscription>('/subscriptions/alerts', {
      id: 'default',
      notifyProducts: false,
      notifyPurchaseRequests: false,
      allCategories: true,
      categories: [],
      allRegions: true,
      regions: [],
      updatedAt: new Date(0).toISOString(),
    }),
    loadOptional<HarvestWatchItem[]>('/products/watches', []),
    loadOptional<UserNotificationItem[]>('/notifications?limit=30', []),
  ]);

  const subscription = subscriptionResult.data;
  const watches = watchesResult.data;
  const inbox = inboxResult.data;
  const loadError =
    subscriptionResult.error || watchesResult.error || inboxResult.error
      ? t('partialLoadError')
      : null;

  return (
    <main className="cabinet-page cabinet-page--narrow">
      {loadError ? <p className="form-error">{loadError}</p> : null}

      <section className="cabinet-section">
        <h2 className="section-title">{t('activeTitle')}</h2>

        <h3 className="subscriptions-subtitle">{t('activeEmailTitle')}</h3>
        <ActiveAlertSubscriptions subscription={subscription} />

        <h3 className="subscriptions-subtitle">{t('harvestWatchesTitle')}</h3>
        <p className="page__subtitle">{t('harvestWatchesHint')}</p>
        <HarvestWatchesList initial={watches} />
        {watches.length === 0 ? (
          <p className="page__subtitle">
            <Link href="/catalog">{t('browseCatalog')}</Link>
          </p>
        ) : null}
      </section>

      <section className="cabinet-section cabinet-section--nested">
        <h2 className="section-title">{t('inboxTitle')}</h2>
        <p className="page__subtitle">{t('inboxHint')}</p>
        <UserNotificationsList initial={inbox} />
      </section>

      <section className="cabinet-section cabinet-section--nested">
        <h2 className="section-title">{t('settingsTitle')}</h2>
        <p className="page__subtitle">{t('settingsHint')}</p>
        <AlertSubscriptionForm initial={subscription} />
      </section>
    </main>
  );
}
