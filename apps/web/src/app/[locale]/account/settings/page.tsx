import { legalLocaleFor, type LegalAcceptanceSnapshot } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';
import { DeleteAccountButton } from '@/components/DeleteAccountButton';
import { EditProfileControl } from '@/components/EditProfileControl';
import { UserAvatarEditor } from '@/components/UserAvatarEditor';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';
import { requireVerifiedUser } from '@/lib/require-verified-user';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AccountSettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireVerifiedUser(locale, '/account/settings');
  const t = await getTranslations('cabinet');

  let legal: LegalAcceptanceSnapshot | null = null;
  try {
    legal = await apiRequestAuthed<LegalAcceptanceSnapshot>('/legal/me');
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error;
    }
  }

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
