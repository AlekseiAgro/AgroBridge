import { canTrade, EMPTY_NOTIFICATION_UNREAD_SUMMARY } from '@agrobridge/shared';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { CabinetMobileMenu } from '@/components/CabinetMobileMenu';
import { ChatNavLink } from '@/components/ChatNavLink';
import { InboxNavLink } from '@/components/InboxNavLink';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LocaleSync } from '@/components/LocaleSync';
import { LogoutButton } from '@/components/LogoutButton';
import { NavLinkWithBadge } from '@/components/NavLinkWithBadge';
import { NotificationBell } from '@/components/NotificationBell';
import { Link } from '@/i18n/navigation';
import { getUnreadMessagesCount } from '@/lib/chat-unread';
import { getPendingInboxCount } from '@/lib/inbox-unread';
import { getNotificationUnreadCounts } from '@/lib/notification-unread';
import { getCurrentUser } from '@/lib/session';

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

export async function CabinetShell({ children, title, subtitle }: Props) {
  const t = await getTranslations('nav');
  const tc = await getTranslations('cabinet');
  const tCatalog = await getTranslations('catalog');
  const tp = await getTranslations('purchaseRequests');
  const user = await getCurrentUser();
  const trader = Boolean(user && canTrade(user.role));
  const [unreadCount, pendingInboxCount, notificationUnread] = await Promise.all([
    user ? getUnreadMessagesCount() : Promise.resolve(0),
    trader ? getPendingInboxCount() : Promise.resolve(0),
    user ? getNotificationUnreadCounts() : Promise.resolve(EMPTY_NOTIFICATION_UNREAD_SUMMARY),
  ]);

  const renderNavigation = () => (
    <>
      <nav className="cabinet__nav" aria-label={tc('shellLabel')}>
        <Link href="/account">{tc('overview')}</Link>

        {trader || user ? (
          <div className="cabinet__nav-group">
            <p className="cabinet__nav-label">{tc('navGroups.activity')}</p>
            {trader ? <InboxNavLink initialCount={pendingInboxCount} /> : null}
            {user ? <ChatNavLink initialCount={unreadCount} /> : null}
          </div>
        ) : null}

        {trader ? (
          <div className="cabinet__nav-group">
            <p className="cabinet__nav-label">{tc('navGroups.selling')}</p>
            <Link href="/dashboard/products">{t('myProducts')}</Link>
            <Link href="/dashboard/farm">{t('myFarm')}</Link>
          </div>
        ) : null}

        <div className="cabinet__nav-group">
          <p className="cabinet__nav-label">{tc('navGroups.market')}</p>
          <Link href="/catalog">{tCatalog('title')}</Link>
          {trader ? (
            <>
              <Link href="/requests">{t('purchaseRequests')}</Link>
              <NavLinkWithBadge
                href="/dashboard/quotes"
                label={t('myQuotes')}
                unreadLabel={t('myQuotesUnread', { count: notificationUnread.quotesUnread })}
                count={notificationUnread.quotesUnread}
              />
              <NavLinkWithBadge
                href="/dashboard/purchase-requests"
                label={tp('mineTitle')}
                unreadLabel={t('purchaseRequestsUnread', {
                  count: notificationUnread.purchaseRequestsUnread,
                })}
                count={notificationUnread.purchaseRequestsUnread}
              />
            </>
          ) : null}
        </div>

        {user ? (
          <div className="cabinet__nav-group">
            <p className="cabinet__nav-label">{tc('navGroups.account')}</p>
            <Link href="/account/settings">{t('settings')}</Link>
            {user.role === 'admin' ? <Link href="/dashboard/admin">{t('admin')}</Link> : null}
          </div>
        ) : null}
      </nav>
      <div className="cabinet__sidebar-foot">
        <LogoutButton />
      </div>
    </>
  );

  return (
    <div className="cabinet">
      {user ? <LocaleSync profileLocale={user.locale} /> : null}
      <aside className="cabinet__sidebar">
        <Link href="/" className="cabinet__brand">
          <BrandLogo />
        </Link>
        <p className="cabinet__eyebrow">{tc('shellLabel')}</p>
        {renderNavigation()}
      </aside>

      <div className="cabinet__main">
        <header className="cabinet__top">
          <div className="cabinet__top-start">
            <CabinetMobileMenu openLabel={tc('openMenu')} closeLabel={tc('closeMenu')}>
              <p className="cabinet__eyebrow">{tc('shellLabel')}</p>
              {renderNavigation()}
            </CabinetMobileMenu>
            <Link href="/" className="cabinet__brand cabinet__brand--bar">
              <BrandLogo />
            </Link>
            <div>
              {title ? <h1 className="cabinet__title">{title}</h1> : null}
              {subtitle ? <p className="cabinet__subtitle">{subtitle}</p> : null}
            </div>
          </div>
          <div className="cabinet__top-actions">
            {user ? (
              <NotificationBell
                count={notificationUnread.totalUnread}
                label={t('notifications')}
                unreadLabel={t('notificationsUnread', { count: notificationUnread.totalUnread })}
              />
            ) : null}
            <LanguageSwitcher />
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
