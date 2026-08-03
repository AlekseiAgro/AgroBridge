import type { PublicUserProfile } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { RatingStars } from '@/components/RatingStars';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { Link } from '@/i18n/navigation';
import { ApiError, apiRequest } from '@/lib/api';
import { formatMemberSinceMonthYear } from '@/lib/member-since';
import { formatRegionLabel } from '@/lib/region';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function PublicUserProfilePage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('profile');
  const ta = await getTranslations('auth');
  const tr = await getTranslations();
  const currentUser = await getCurrentUser();

  let profile: PublicUserProfile;
  try {
    profile = await apiRequest<PublicUserProfile>(`/users/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const name = profile.displayName || t('anonymous');
  const roleKey = `roles.${profile.role}` as 'roles.farmer' | 'roles.buyer' | 'roles.admin';
  const memberSince = formatMemberSinceMonthYear(profile.memberSince, locale);
  const isOwnProfile = currentUser?.id === profile.id;
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main">
        <p className="eyebrow">{t('eyebrow')}</p>
        <section className="user-card profile-card">
          <div className="user-card__identity">
            <div className="user-card__avatar" aria-hidden>
              {initial}
            </div>
            <div>
              <h1 className="user-card__name">{name}</h1>
              <p className="user-card__meta">
                {ta(roleKey)}
                {profile.sellerType
                  ? ` · ${ta(`sellerTypes.${profile.sellerType}`)}`
                  : ''}
              </p>
              <p className="user-card__meta">{t('memberSince', { date: memberSince })}</p>
            </div>
          </div>
          <div className="user-card__rating">
            <p className="user-card__rating-label">{t('rating')}</p>
            <RatingStars value={profile.rating.average} count={profile.rating.count} />
            <p className="user-card__rating-hint">{t('ratingHint')}</p>
          </div>
        </section>

        <section className="activity-summary" aria-labelledby="profile-stats-title">
          <h2 id="profile-stats-title" className="section-title">
            {t('statsTitle')}
          </h2>
          <ul className="activity-summary__grid">
            <li>
              <strong>{profile.completedDeals}</strong>
              <span>{t('completedDeals')}</span>
            </li>
            <li>
              <strong>
                {profile.rating.average == null ? '—' : profile.rating.average.toFixed(1)}
              </strong>
              <span>{t('ratingAverage')}</span>
            </li>
            <li>
              <strong>{profile.rating.count}</strong>
              <span>{t('ratingCount')}</span>
            </li>
          </ul>
        </section>

        {profile.farm ? (
          <section className="profile-farm">
            <h2 className="section-title">{t('farmTitle')}</h2>
            <div className="product-list__item">
              <Link href={`/farms/${profile.farm.id}`} className="product-list__title">
                {profile.farm.name}
              </Link>
              <p className="product-list__meta">
                {formatRegionLabel(profile.farm.region, tr) || t('regionUnknown')}
                {` · ${t('productCount', { count: profile.farm.productCount })}`}
              </p>
              {profile.farm.description ? (
                <p className="product-list__desc">{profile.farm.description}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {isOwnProfile ? (
          <p className="eyebrow" style={{ marginTop: '1.5rem' }}>
            <Link href="/account">{t('backToCabinet')}</Link>
          </p>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
