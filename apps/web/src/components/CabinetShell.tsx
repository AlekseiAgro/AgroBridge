import { canTrade } from '@agrobridge/shared';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { ChatNavLink } from '@/components/ChatNavLink';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LocaleSync } from '@/components/LocaleSync';
import { LogoutButton } from '@/components/LogoutButton';
import { Link } from '@/i18n/navigation';
import { getUnreadMessagesCount } from '@/lib/chat-unread';
import { getCurrentUser } from '@/lib/session';

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

export async function CabinetShell({ children, title, subtitle }: Props) {
  const t = await getTranslations('nav');
  const tc = await getTranslations('cabinet');
  const tp = await getTranslations('purchaseRequests');
  const user = await getCurrentUser();
  const trader = Boolean(user && canTrade(user.role));
  const unreadCount = user ? await getUnreadMessagesCount() : 0;

  return (
    <div className="cabinet">
      {user ? <LocaleSync profileLocale={user.locale} /> : null}
      <aside className="cabinet__sidebar">
        <Link href="/" className="cabinet__brand">
          AgroBridge
        </Link>
        <p className="cabinet__eyebrow">{tc('shellLabel')}</p>
        <nav className="cabinet__nav">
          <Link href="/account">{tc('overview')}</Link>
          {trader ? (
            <>
              <Link href="/dashboard/farm">{t('myFarm')}</Link>
              <Link href="/dashboard/products">{t('myProducts')}</Link>
              <Link href="/dashboard/inbox">{t('inbox')}</Link>
              <Link href="/requests">{t('purchaseRequests')}</Link>
              <Link href="/dashboard/purchase-requests">{tp('mineTitle')}</Link>
              <Link href="/dashboard/rfqs">{t('myRequests')}</Link>
            </>
          ) : null}
          {user ? <ChatNavLink initialCount={unreadCount} /> : null}
          {user ? <Link href="/dashboard/subscriptions">{t('subscriptions')}</Link> : null}
          {user?.role === 'admin' ? <Link href="/dashboard/admin">{t('admin')}</Link> : null}
          <Link href="/buyers">{t('forBuyers')}</Link>
          <Link href="/sellers">{t('forSellers')}</Link>
        </nav>
        <div className="cabinet__sidebar-foot">
          <LanguageSwitcher />
          <LogoutButton />
        </div>
      </aside>

      <div className="cabinet__main">
        <header className="cabinet__top">
          <div>
            {title ? <h1 className="cabinet__title">{title}</h1> : null}
            {subtitle ? <p className="cabinet__subtitle">{subtitle}</p> : null}
          </div>
          <div className="cabinet__top-actions">
            {user ? (
              <ChatNavLink
                className="button button--ghost cabinet__chat-button"
                initialCount={unreadCount}
              />
            ) : null}
            <span className="cabinet__user-chip">
              {user?.displayName || user?.email || tc('guest')}
            </span>
          </div>
        </header>
        <div className="cabinet__content">{children}</div>
      </div>
    </div>
  );
}
