import type { CabinetOverview } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CabinetShell } from '@/components/CabinetShell';
import { RatingStars } from '@/components/RatingStars';
import { Link, redirect } from '@/i18n/navigation';
import { formatMemberSinceMonthYear } from '@/lib/member-since';
import { apiRequestAuthed } from '@/lib/server-api';
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

  const t = await getTranslations('cabinet');
  const ta = await getTranslations('auth');
  const tn = await getTranslations('nav');
  const tProfile = await getTranslations('profile');
  const overview = await apiRequestAuthed<CabinetOverview>('/cabinet/overview');
  const { user, activity } = overview;
  const isFarmer = user.role === 'farmer' || user.role === 'admin';
  const isBuyer = user.role === 'buyer' || user.role === 'admin';
  const roleKey = `roles.${user.role}` as 'roles.farmer' | 'roles.buyer' | 'roles.admin';
  const memberSince = formatMemberSinceMonthYear(user.memberSince, locale);

  return (
    <CabinetShell title={t('title')} subtitle={t('subtitle')}>
      <section className="user-card">
        <div className="user-card__identity">
          <div className="user-card__avatar" aria-hidden>
            {(user.displayName || user.email).slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h2 className="user-card__name">{user.displayName || t('noDisplayName')}</h2>
            <p className="user-card__meta">
              {ta(roleKey)}
              {user.sellerType
                ? ` · ${ta(`sellerTypes.${user.sellerType}`)}`
                : ''}
              {user.buyerType
                ? ` · ${ta(`buyerTypes.${user.buyerType}`)}`
                : ''}
              {' · '}
              {user.email}
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
          <li>
            <strong>{activity.completedDeals}</strong>
            <span>{t('stats.completedDeals')}</span>
          </li>
          <li>
            <strong>{activity.openRequests}</strong>
            <span>{t('stats.openRequests')}</span>
          </li>
          <li>
            <strong>{activity.conversations}</strong>
            <span>{t('stats.conversations')}</span>
          </li>
          {isFarmer ? (
            <>
              <li>
                <strong>{activity.publishedProducts}</strong>
                <span>{t('stats.publishedProducts')}</span>
              </li>
              <li>
                <strong>{activity.pendingModeration}</strong>
                <span>{t('stats.pendingModeration')}</span>
              </li>
            </>
          ) : null}
          <li>
            <strong>{activity.awaitingMyRating}</strong>
            <span>{t('stats.awaitingMyRating')}</span>
          </li>
        </ul>
      </section>

      <section className="cabinet-links">
        <h2 className="section-title">{t('quickLinks')}</h2>
        <div className="home__actions">
          <Link className="button button--ghost" href="/buyers">
            {tn('forBuyers')}
          </Link>
          <Link className="button button--ghost" href="/sellers">
            {tn('forSellers')}
          </Link>
          {isFarmer ? (
            <>
              <Link className="button button--primary" href="/dashboard/farm">
                {tn('myFarm')}
              </Link>
              <Link className="button button--ghost" href="/dashboard/products">
                {tn('myProducts')}
              </Link>
              <Link className="button button--ghost" href="/dashboard/inbox">
                {tn('inbox')}
              </Link>
            </>
          ) : null}
          {isBuyer ? (
            <>
              <Link className="button button--primary" href="/requests/new">
                {tn('purchaseRequests')}
              </Link>
              <Link className="button button--ghost" href="/dashboard/purchase-requests">
                {tn('purchaseRequests')}
              </Link>
              <Link className="button button--ghost" href="/dashboard/rfqs">
                {tn('myRequests')}
              </Link>
            </>
          ) : null}
          <Link className="button button--ghost" href="/dashboard/chat">
            {tn('chat')}
          </Link>
          <Link className="button button--ghost" href="/dashboard/subscriptions">
            {tn('subscriptions')}
          </Link>
        </div>
      </section>
    </CabinetShell>
  );
}
