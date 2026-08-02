import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LogoutButton } from '@/components/LogoutButton';
import { Link, redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect({ href: '/login', locale });
  }

  const user = currentUser!;
  const t = await getTranslations('account');
  const ta = await getTranslations('auth');
  const roleKey = `roles.${user.role}` as 'roles.farmer' | 'roles.buyer' | 'roles.admin';

  return (
    <div className="auth-page">
      <header className="auth-page__top">
        <Link href="/" className="auth-brand">
          AgroBridge
        </Link>
        <div className="auth-page__actions">
          <LanguageSwitcher />
          <LogoutButton />
        </div>
      </header>

      <main className="auth-card">
        <h1>{t('title')}</h1>
        <p className="auth-card__subtitle">{t('subtitle')}</p>

        <dl className="account-details">
          <div>
            <dt>{ta('displayName')}</dt>
            <dd>{user.displayName || t('noDisplayName')}</dd>
          </div>
          <div>
            <dt>{ta('email')}</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>{ta('role')}</dt>
            <dd>{ta(roleKey)}</dd>
          </div>
          <div>
            <dt>{t('locale')}</dt>
            <dd>{user.locale}</dd>
          </div>
        </dl>
      </main>
    </div>
  );
}
