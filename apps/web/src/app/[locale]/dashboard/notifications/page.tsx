import type { UserNotificationItem } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { UserNotificationsList } from '@/components/UserNotificationsList';
import { ApiError } from '@/lib/api';
import { requireVerifiedUser } from '@/lib/require-verified-user';
import { apiRequestAuthed } from '@/lib/server-api';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NotificationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireVerifiedUser(locale, '/dashboard/notifications');
  const t = await getTranslations('notifications');

  let items: UserNotificationItem[] = [];
  let loadError: string | null = null;
  try {
    items = await apiRequestAuthed<UserNotificationItem[]>('/notifications?limit=30');
  } catch (error) {
    loadError =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : t('loadError');
  }

  return (
    <main className="cabinet-page">
      <div className="page__heading-row">
        <div>
          <h1>{t('title')}</h1>
          <p className="page__subtitle">{t('subtitle')}</p>
        </div>
      </div>
      {loadError ? (
        <p className="form-error">{t('loadError')}</p>
      ) : (
        <UserNotificationsList initial={items} copyNamespace="notifications" />
      )}
    </main>
  );
}
