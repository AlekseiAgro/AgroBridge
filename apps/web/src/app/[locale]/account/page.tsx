import type { CabinetOverview } from '@agrobridge/shared';
import { canTrade } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChatUnreadBadge } from '@/components/ChatNavLink';
import { CabinetShell } from '@/components/CabinetShell';
import { DeleteAccountButton } from '@/components/DeleteAccountButton';
import { EditProfileControl } from '@/components/EditProfileControl';
import { RatingStars } from '@/components/RatingStars';
import { UserAvatarEditor } from '@/components/UserAvatarEditor';
import { Link } from '@/i18n/navigation';
import { formatMemberSinceMonthYear } from '@/lib/member-since';
import { apiRequestAuthed } from '@/lib/server-api';
import { requireVerifiedUser } from '@/lib/require-verified-user';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireVerifiedUser(locale, '/account');

  const t = await getTranslations('cabinet');
  const ta = await getTranslations('auth');
  const tProfile = await getTranslations('profile');
  const overview = await apiRequestAuthed<CabinetOverview>('/cabinet/overview');
  const { user, activity } = overview;
  const trader = canTrade(user.role);
  const roleKey = `roles.${user.role}` as 'roles.farmer' | 'roles.buyer' | 'roles.admin';
  const memberSince = formatMemberSinceMonthYear(user.memberSince, locale);
  const dealsBase = user.role === 'farmer' ? '/dashboard/inbox' : '/dashboard/rfqs';
  const openRequestsHref =
    user.role === 'farmer' ? `${dealsBase}?status=open` : '/dashboard/purchase-requests';

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
      href: `${dealsBase}?status=completed`,
    },
    {
      key: 'openRequests',
      value: activity.openRequests,
      label: t('stats.openRequests'),
      href: openRequestsHref,
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
    href: `${dealsBase}?needsRating=1`,
  });

  return (
    <CabinetShell title={t('title')} subtitle={t('subtitle')}>
      <section className="user-card">
        <div className="user-card__identity">
          <UserAvatarEditor
            avatarUrl={user.avatarUrl}
            fallbackInitial={(user.displayName || user.email).slice(0, 1).toUpperCase()}
          />
          <div>
            <EditProfileControl initialDisplayName={user.displayName} email={user.email} />
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
          <RatingStars value={user.rating.average} count={user.rating.count} />
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
              <Link href={card.href} className="activity-summary__link">
                <strong>
                  {card.value}
                  {card.unreadBadge ? (
                    <ChatUnreadBadge count={card.unreadBadge} className="activity-summary__unread" />
                  ) : null}
                </strong>
                <span>{card.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {user.role !== 'admin' ? (
        <section className="cabinet-danger">
          <DeleteAccountButton email={user.email} />
        </section>
      ) : null}
    </CabinetShell>
  );
}
