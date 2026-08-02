import { RATING_MAX_SCORE } from '@agrobridge/shared';

type Props = {
  value: number | null;
  count?: number;
  size?: 'sm' | 'md';
  showValue?: boolean;
};

export function RatingStars({
  value,
  count,
  size = 'md',
  showValue = true,
}: Props) {
  const score = value ?? 0;
  const className = size === 'sm' ? 'rating-stars rating-stars--sm' : 'rating-stars';

  return (
    <div className={className} aria-label={value == null ? 'No ratings yet' : `${value} of ${RATING_MAX_SCORE}`}>
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
          {typeof count === 'number' ? ` (${count})` : ''}
        </span>
      ) : null}
    </div>
  );
}
