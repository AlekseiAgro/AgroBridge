import { getTranslations } from 'next-intl/server';
import { BrandLogo } from '@/components/BrandLogo';
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
      <Link href="/" className="auth-brand brand-logo-link" aria-label="AgroBridge">
        <BrandLogo variant="horizontal" tone={tone} />
      </Link>
      <nav className="site-header__nav">
        <Link href="/catalog">{t('catalog')}</Link>
        <Link href="/how-it-works">{t('howItWorks')}</Link>
        {user?.role === 'farmer' || user?.role === 'admin' ? (
          <>
            <Link href="/dashboard/farm">{t('myFarm')}</Link>
            <Link href="/dashboard/products">{t('myProducts')}</Link>
            <Link href="/dashboard/inbox">{t('inbox')}</Link>
          </>
        ) : null}
        {user?.role === 'buyer' || user?.role === 'admin' ? (
          <Link href="/dashboard/rfqs">{t('myRequests')}</Link>
        ) : null}
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
