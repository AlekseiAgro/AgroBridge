import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/session';

type Props = {
  tone?: 'default' | 'light';
};

export async function SiteHeader({ tone = 'default' }: Props) {
  const t = await getTranslations('nav');
  const user = await getCurrentUser();

  return (
    <header className={tone === 'light' ? 'site-header site-header--light' : 'site-header'}>
      <Link href="/" className="auth-brand">
        AgroBridge
      </Link>
      <nav className="site-header__nav">
        <Link href="/buyers" className="site-header__role-link">
          {t('forBuyers')}
        </Link>
        <Link href="/sellers" className="site-header__role-link">
          {t('forSellers')}
        </Link>
        <Link href="/how-it-works">{t('howItWorks')}</Link>
        {user ? <Link href="/dashboard/chat">{t('chat')}</Link> : null}
        {user?.role === 'admin' ? <Link href="/dashboard/admin">{t('admin')}</Link> : null}
        {user ? (
          <Link href="/account">{t('account')}</Link>
        ) : (
          <>
            <Link href="/login">{t('login')}</Link>
            <Link href="/register">{t('register')}</Link>
          </>
        )}
        <LanguageSwitcher />
      </nav>
    </header>
  );
}
