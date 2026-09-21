import type { CabinetOverview } from '@agrobridge/shared';
import { canTrade, EMPTY_NOTIFICATION_UNREAD_SUMMARY } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChatUnreadBadge } from '@/components/ChatNavLink';
import { RatingStars } from '@/components/RatingStars';
import { Link } from '@/i18n/navigation';
import { formatMemberSinceMonthYear } from '@/lib/member-since';
import { toPublicMediaUrl } from '@/lib/product-image';
import { apiRequestAuthed } from '@/lib/server-api';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('cabinet');
  const ta = await getTranslations('auth');
  const tProfile = await getTranslations('profile');
  const overview = await apiRequestAuthed<CabinetOverview>('/cabinet/overview');
  const { user, activity, notificationUnread = EMPTY_NOTIFICATION_UNREAD_SUMMARY } = overview;
  const trader = canTrade(user.role);
  const roleKey = `roles.${user.role}` as 'roles.farmer' | 'roles.buyer' | 'roles.admin';
  const memberSince = formatMemberSinceMonthYear(user.memberSince, locale);
  const cards: Array<{
    key: string;
    value: number;
    label: string;
    href: string;
    unreadBadge?: number;
  }> = [
    {
      key: 'completedDeals',
      value: activity.completedDeals,
      label: t('stats.completedDeals'),
      href: '/dashboard/deals',
    },
    {
      key: 'openPurchaseRequests',
      value: activity.openPurchaseRequests,
      label: t('stats.openPurchaseRequests'),
      href: '/dashboard/purchase-requests',
      unreadBadge: notificationUnread.purchaseRequestsUnread,
    },
    {
      key: 'pendingQuotes',
      value: activity.pendingQuotes,
      label: t('stats.pendingQuotes'),
      href: '/dashboard/quotes',
      unreadBadge: notificationUnread.pendingQuotesUnread,
    },
    {
      key: 'acceptedQuotes',
      value: activity.acceptedQuotes,
      label: t('stats.acceptedQuotes'),
      href: '/dashboard/quotes',
      unreadBadge: notificationUnread.acceptedQuotesUnread,
    },
    {
      key: 'conversations',
      value: activity.conversations,
      label: t('stats.conversations'),
      href: '/dashboard/chat',
      unreadBadge: activity.unreadMessages,
    },
  ];

  if (trader) {
    cards.push(
      {
        key: 'publishedProducts',
        value: activity.publishedProducts,
        label: t('stats.publishedProducts'),
        href: '/dashboard/products?filter=published',
      },
      {
        key: 'pendingModeration',
        value: activity.pendingModeration,
        label: t('stats.pendingModeration'),
        href: '/dashboard/products?filter=pending',
      },
    );
  }

  cards.push({
    key: 'awaitingMyRating',
    value: activity.awaitingMyRating,
    label: t('stats.awaitingMyRating'),
    href: '/dashboard/deals?needsRating=1',
  });

  return (
    <main className="cabinet-page">
      <div className="page__heading-row">
        <div>
          <h1>{t('title')}</h1>
          <p className="page__subtitle">{t('subtitle')}</p>
        </div>
      </div>

      <section className="user-card">
        <div className="user-card__identity">
          <div className="user-card__avatar" aria-hidden>
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={toPublicMediaUrl(user.avatarUrl)} alt="" />
            ) : (
              (user.displayName || user.email).slice(0, 1).toUpperCase()
            )}
          </div>
          <div>
            <h2 className="user-card__name">{user.displayName?.trim() || t('noDisplayName')}</h2>
            <p className="user-card__meta">{user.email}</p>
            <p className="user-card__meta">
              {ta(roleKey)}
              {user.sellerType
                ? ` · ${ta(`sellerTypes.${user.sellerType}`)}`
                : ''}
              {user.buyerType
                ? ` · ${ta(`buyerTypes.${user.buyerType}`)}`
                : ''}
            </p>
            <p className="user-card__meta">{t('memberSince', { date: memberSince })}</p>
            <p className="user-card__meta">
              <Link href={`/users/${user.id}`} className="profile-link">
                {tProfile('viewPublicProfile')}
              </Link>
            </p>
          </div>
        </div>
        <div className="user-card__rating">
          <p className="user-card__rating-label">{t('rating')}</p>
          <RatingStars
            value={user.rating.average}
            count={user.rating.count}
            reviewsHref={`/users/${user.id}/reviews`}
          />
          <p className="user-card__rating-hint">{t('ratingHint')}</p>
        </div>
      </section>

      <section className="activity-summary" aria-labelledby="activity-summary-title">
        <h2 id="activity-summary-title" className="section-title">
          {t('activityTitle')}
        </h2>
        <ul className="activity-summary__grid">
          {cards.map((card) => (
            <li key={card.key}>
              <Link
                href={card.href}
                className="activity-summary__link"
                aria-label={
                  card.unreadBadge
                    ? t('unreadCard', { label: card.label, count: card.unreadBadge })
                    : undefined
                }
              >
                <span className="activity-summary__value">
                  <strong>{card.value}</strong>
                  {card.unreadBadge ? (
                    <ChatUnreadBadge count={card.unreadBadge} className="activity-summary__unread" />
                  ) : null}
                </span>
                <span>{card.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

    </main>
  );
}
