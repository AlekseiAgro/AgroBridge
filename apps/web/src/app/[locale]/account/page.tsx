import type { CabinetOverview } from '@agrobridge/shared';
import { canTrade } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CabinetShell } from '@/components/CabinetShell';
import { ChangeEmailButton } from '@/components/ChangeEmailButton';
import { DeleteAccountButton } from '@/components/DeleteAccountButton';
import { EditDisplayNameForm } from '@/components/EditDisplayNameForm';
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

  return (
    <CabinetShell title={t('title')} subtitle={t('subtitle')}>
      <section className="user-card">
        <div className="user-card__identity">
          <UserAvatarEditor
            avatarUrl={user.avatarUrl}
            fallbackInitial={(user.displayName || user.email).slice(0, 1).toUpperCase()}
          />
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

      <section className="profile-settings" aria-labelledby="profile-settings-title">
        <h2 id="profile-settings-title" className="section-title">
          {t('profileSettingsTitle')}
        </h2>
        <EditDisplayNameForm initialDisplayName={user.displayName} />
        <ChangeEmailButton email={user.email} />
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
          {trader ? (
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

      {user.role !== 'admin' ? (
        <section className="cabinet-danger">
          <DeleteAccountButton email={user.email} />
        </section>
      ) : null}
    </CabinetShell>
  );
}
