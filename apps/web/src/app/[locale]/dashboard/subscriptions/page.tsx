import type { AlertSubscription } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AlertSubscriptionForm } from '@/components/AlertSubscriptionForm';
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
  const subscription = await apiRequestAuthed<AlertSubscription>('/subscriptions/alerts');

  return (
    <main className="cabinet-page cabinet-page--narrow">
      <h1>{t('title')}</h1>
      <p className="page__subtitle">{t('subtitle')}</p>
      <AlertSubscriptionForm initial={subscription} />
    </main>
  );
}
