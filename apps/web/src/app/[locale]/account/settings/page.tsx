import {
  legalLocaleFor,
  type AlertSubscription,
  type HarvestWatchItem,
  type LegalAcceptanceSnapshot,
} from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';
import { DeleteAccountButton } from '@/components/DeleteAccountButton';
import { EditProfileControl } from '@/components/EditProfileControl';
import { HarvestWatchesList } from '@/components/HarvestWatchesList';
import { SettingsEmailAlertsControl } from '@/components/SettingsEmailAlertsControl';
import { UserAvatarEditor } from '@/components/UserAvatarEditor';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';
import { requireVerifiedUser } from '@/lib/require-verified-user';

const EMPTY_ALERT_SUBSCRIPTION: AlertSubscription = {
  id: 'default',
  notifyProducts: false,
  notifyPurchaseRequests: false,
  allCategories: true,
  categories: [],
  allRegions: true,
  regions: [],
  updatedAt: new Date(0).toISOString(),
};

async function loadOptional<T>(path: string, fallback: T): Promise<{ data: T; error: boolean }> {
  try {
    return { data: await apiRequestAuthed<T>(path), error: false };
  } catch (error) {
    if (error instanceof ApiError) {
      return { data: fallback, error: true };
    }
    throw error;
  }
}

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AccountSettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireVerifiedUser(locale, '/account/settings');
  const t = await getTranslations('cabinet');

  const [legalResult, alertsResult, watchesResult] = await Promise.all([
    loadOptional<LegalAcceptanceSnapshot | null>('/legal/me', null),
    loadOptional<AlertSubscription>('/subscriptions/alerts', EMPTY_ALERT_SUBSCRIPTION),
    loadOptional<HarvestWatchItem[]>('/products/watches', []),
  ]);

  const legal = legalResult.data;
  const subscription = alertsResult.data;
  const watches = watchesResult.data;
  const notificationsLoadError = alertsResult.error || watchesResult.error;

  const legalLocale = legalLocaleFor(locale);
  const acceptedAt = legal?.terms.acceptedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
        new Date(legal.terms.acceptedAt),
      )
    : null;
  const acceptanceStatus =
    legal?.terms.accepted && legal.terms.documentVersion && acceptedAt
      ? t('termsAcceptedAt', {
          version: legal.terms.documentVersion,
          date: acceptedAt,
        })
      : t('termsNotAccepted');

  return (
    <main className="cabinet-page cabinet-page--settings">
      <div className="page__heading-row">
        <div>
          <h1>{t('settingsTitle')}</h1>
          <p className="page__subtitle">{t('settingsSubtitle')}</p>
        </div>
      </div>

      <section className="cabinet-profile" aria-labelledby="cabinet-profile-title">
        <h2 id="cabinet-profile-title" className="section-title">
          {t('profileSettingsTitle')}
        </h2>
        <div className="settings-list">
          <UserAvatarEditor
            avatarUrl={user.avatarUrl}
            fallbackInitial={(user.displayName || user.email).slice(0, 1).toUpperCase()}
          />
          <EditProfileControl initialDisplayName={user.displayName} email={user.email} />
        </div>
      </section>

      <section className="cabinet-security" aria-labelledby="cabinet-security-title">
        <h2 id="cabinet-security-title" className="section-title">
          {t('securityTitle')}
        </h2>
        <ChangePasswordForm />
      </section>

      <section
        id="notifications"
        className="cabinet-notifications"
        aria-labelledby="cabinet-notifications-title"
      >
        <h2 id="cabinet-notifications-title" className="section-title">
          {t('notificationsSettingsTitle')}
        </h2>
        <p className="page__subtitle">{t('notificationsSettingsSubtitle')}</p>
        {notificationsLoadError ? <p className="form-error">{t('notificationsLoadError')}</p> : null}
        <div className="settings-list">
          <SettingsEmailAlertsControl initial={subscription} />
          <div className="settings-row settings-row--stack">
            <p className="settings-row__label">{t('harvestNotificationsTitle')}</p>
            <p className="settings-row__value">{t('harvestNotificationsHint')}</p>
            {watches.length > 0 ? (
              <HarvestWatchesList initial={watches} />
            ) : (
              <div className="empty-state">
                <p>{t('harvestNotificationsEmpty')}</p>
                <Link href="/catalog" className="button button--ghost">
                  {t('harvestNotificationsBrowse')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="cabinet-legal" aria-labelledby="cabinet-legal-title">
        <h2 id="cabinet-legal-title" className="section-title">
          {t('legalTitle')}
        </h2>
        {legal ? (
          <div className="settings-list">
            <Link href="/terms" locale={legalLocale} className="settings-row settings-row--link">
              <span className="settings-row__label">{t('viewTerms')}</span>
              <span className="settings-row__chevron" aria-hidden>
                →
              </span>
            </Link>
            <Link href="/privacy" locale={legalLocale} className="settings-row settings-row--link">
              <span className="settings-row__label">{t('viewPrivacy')}</span>
              <span className="settings-row__chevron" aria-hidden>
                →
              </span>
            </Link>
            <div className="settings-row">
              <p className="settings-row__label">{t('legalAcceptanceLabel')}</p>
              <p className="settings-row__value">{acceptanceStatus}</p>
            </div>
            <p className="cabinet-legal__hint">{t('privacyTransparency')}</p>
            <p className="cabinet-legal__hint">{t('privacyNotAccepted')}</p>
          </div>
        ) : (
          <p className="cabinet-legal__hint">{t('legalLoadError')}</p>
        )}
      </section>

      {user.role !== 'admin' ? (
        <section className="cabinet-danger" aria-labelledby="cabinet-danger-title">
          <h2 id="cabinet-danger-title" className="section-title">
            {t('deleteAccountTitle')}
          </h2>
          <DeleteAccountButton email={user.email} />
        </section>
      ) : null}
    </main>
  );
}
