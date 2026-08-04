import type { PublicRatingReviews, PublicUserProfile } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { RatingStars } from '@/components/RatingStars';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { Link } from '@/i18n/navigation';
import { ApiError, apiRequest } from '@/lib/api';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function UserReviewsPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('profile');

  let profile: PublicUserProfile;
  let reviews: PublicRatingReviews;
  try {
    [profile, reviews] = await Promise.all([
      apiRequest<PublicUserProfile>(`/users/${id}`),
      apiRequest<PublicRatingReviews>(`/users/${id}/ratings`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const name = profile.displayName || t('anonymous');

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main">
        <p className="eyebrow">
          <Link href={`/users/${profile.id}`}>{t('backToProfile')}</Link>
        </p>
        <h1>{t('reviewsTitle', { name })}</h1>
        <p className="page__subtitle">{t('reviewsSubtitle')}</p>
        <div className="reviews-summary">
          <RatingStars value={profile.rating.average} count={profile.rating.count} />
        </div>

        {reviews.items.length === 0 ? (
          <p className="empty-state">{t('reviewsEmpty')}</p>
        ) : (
          <ul className="reviews-list">
            {reviews.items.map((review) => {
              const author = review.fromUser.displayName || t('anonymous');
              const dateLabel = new Date(review.createdAt).toLocaleDateString(locale);

              return (
                <li key={review.id} className="reviews-list__item">
                  <div className="reviews-list__header">
                    <Link href={`/users/${review.fromUser.id}`} className="reviews-list__author">
                      {author}
                    </Link>
                    <RatingStars value={review.score} showValue size="sm" />
                  </div>
                  {review.comment ? (
                    <p className="reviews-list__comment">{review.comment}</p>
                  ) : (
                    <p className="reviews-list__comment reviews-list__comment--muted">
                      {t('reviewsNoComment')}
                    </p>
                  )}
                  <p className="reviews-list__meta">{dateLabel}</p>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
