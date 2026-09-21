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
  const ta = await getTranslations('auth');

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

  return (
    <main className="cabinet-page">
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
        <p className="cabinet-profile__hint">{t('profileSettingsHint')}</p>
        <div className="cabinet-profile__identity">
          <UserAvatarEditor
            avatarUrl={user.avatarUrl}
            fallbackInitial={(user.displayName || user.email).slice(0, 1).toUpperCase()}
          />
          <EditProfileControl
            alwaysOpen
            initialDisplayName={user.displayName}
            email={user.email}
          />
        </div>
      </section>

      <section className="cabinet-security" aria-labelledby="cabinet-security-title">
        <h2 id="cabinet-security-title" className="section-title">
          {t('securityTitle')}
        </h2>
        <p className="cabinet-security__hint">{ta('changePasswordHint')}</p>
        <ChangePasswordForm />
      </section>

      <section className="cabinet-legal" aria-labelledby="cabinet-legal-title">
        <h2 id="cabinet-legal-title" className="section-title">
          {t('legalTitle')}
        </h2>
        <p className="cabinet-legal__hint">{t('legalSubtitle')}</p>
        {legal ? (
          <>
            <p>
              {t('currentTerms')}
              {legal.currentTerms
                ? ` — ${t('termsVersion', { version: legal.currentTerms.version })}`
                : ''}
            </p>
            <p>
              {legal.terms.accepted && legal.terms.documentVersion && acceptedAt
                ? t('termsAcceptedAt', {
                    version: legal.terms.documentVersion,
                    date: acceptedAt,
                  })
                : t('termsNotAccepted')}
            </p>
            <p>
              <Link href="/terms" locale={legalLocale}>
                {t('viewTerms')}
              </Link>
            </p>
            <p>
              <Link href="/privacy" locale={legalLocale}>
                {t('viewPrivacy')}
              </Link>
            </p>
            <p className="cabinet-legal__hint">{t('privacyTransparency')}</p>
            <p className="cabinet-legal__hint">{t('privacyNotAccepted')}</p>
          </>
        ) : (
          <p className="cabinet-legal__hint">{t('legalLoadError')}</p>
        )}
      </section>

      {user.role !== 'admin' ? (
        <section className="cabinet-danger">
          <DeleteAccountButton email={user.email} />
        </section>
      ) : null}
    </main>
  );
}
