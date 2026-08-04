import { RATING_MAX_SCORE } from '@agrobridge/shared';
import { Link } from '@/i18n/navigation';

type Props = {
  value: number | null;
  count?: number;
  size?: 'sm' | 'md';
  showValue?: boolean;
  /** When set and count > 0, the rating count opens the reviews list. */
  reviewsHref?: string;
};

export function RatingStars({
  value,
  count,
  size = 'md',
  showValue = true,
  reviewsHref,
}: Props) {
  const score = value ?? 0;
  const className = size === 'sm' ? 'rating-stars rating-stars--sm' : 'rating-stars';
  const countLabel = typeof count === 'number' ? ` (${count})` : '';
  const countIsLink = Boolean(reviewsHref && typeof count === 'number' && count > 0);

  return (
    <div
      className={className}
      aria-label={value == null ? 'No ratings yet' : `${value} of ${RATING_MAX_SCORE}`}
    >
      <span className="rating-stars__glyphs" aria-hidden>
        {Array.from({ length: RATING_MAX_SCORE }, (_, index) => {
          const filled = score >= index + 1 || score > index + 0.5;
          const half = !filled && score > index && score < index + 1;
          return (
            <span
              key={index}
              className={
                filled
                  ? 'rating-stars__star rating-stars__star--on'
                  : half
                    ? 'rating-stars__star rating-stars__star--half'
                    : 'rating-stars__star'
              }
            >
              ★
            </span>
          );
        })}
      </span>
      {showValue ? (
        <span className="rating-stars__meta">
          {value == null ? '—' : value.toFixed(1)}
          {countIsLink ? (
            <Link href={reviewsHref!} className="rating-stars__count-link">
              {countLabel}
            </Link>
          ) : (
            countLabel
          )}
        </span>
      ) : null}
    </div>
  );
}
