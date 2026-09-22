import { getTranslations } from 'next-intl/server';
import { BrandLogo } from '@/components/BrandLogo';
import { ChatNavLink } from '@/components/ChatNavLink';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LocaleSync } from '@/components/LocaleSync';
import { PublicHeaderMenu } from '@/components/PublicHeaderMenu';
import { Link } from '@/i18n/navigation';
import { getUnreadMessagesCount } from '@/lib/chat-unread';
import { getCurrentUser } from '@/lib/session';

type Props = {
  tone?: 'default' | 'light';
};

export async function SiteHeader({ tone = 'default' }: Props) {
  const t = await getTranslations('nav');
  const tc = await getTranslations('cabinet');
  const user = await getCurrentUser();
  const unreadCount = user ? await getUnreadMessagesCount() : 0;

  return (
    <>
      {user ? <LocaleSync profileLocale={user.locale} /> : null}
      <header className={tone === 'light' ? 'site-header site-header--light' : 'site-header'}>
        <PublicHeaderMenu
          openLabel={tc('openMenu')}
          closeLabel={tc('closeMenu')}
          brand={
            <Link href="/" className="auth-brand">
              <BrandLogo />
              <span className="auth-brand__wordmark">AgroBridge</span>
            </Link>
          }
          toolbar={<LanguageSwitcher />}
        >
          <Link href="/catalog">{t('catalog')}</Link>
          <Link href="/requests">{t('purchaseRequests')}</Link>
          <Link href="/how-it-works">{t('howItWorks')}</Link>
          {user ? <ChatNavLink initialCount={unreadCount} /> : null}
          {user?.role === 'admin' ? <Link href="/dashboard/admin">{t('admin')}</Link> : null}
          {user ? (
            <Link href="/account">{t('account')}</Link>
          ) : (
            <>
              <Link href="/login">{t('login')}</Link>
              <Link href="/register">{t('register')}</Link>
            </>
          )}
        </PublicHeaderMenu>
      </header>
    </>
  );
}
