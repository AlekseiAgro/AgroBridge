import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';
import { DeleteAccountButton } from '@/components/DeleteAccountButton';
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

  return (
    <main className="cabinet-page">
      <div className="page__heading-row">
        <div>
          <h1>{t('settingsTitle')}</h1>
          <p className="page__subtitle">{t('settingsSubtitle')}</p>
        </div>
      </div>

      <section className="cabinet-security" aria-labelledby="cabinet-security-title">
        <h2 id="cabinet-security-title" className="section-title">
          {t('securityTitle')}
        </h2>
        <p className="cabinet-security__hint">{ta('changePasswordHint')}</p>
        <ChangePasswordForm />
      </section>

      {user.role !== 'admin' ? (
        <section className="cabinet-danger">
          <DeleteAccountButton email={user.email} />
        </section>
      ) : null}
    </main>
  );
}
