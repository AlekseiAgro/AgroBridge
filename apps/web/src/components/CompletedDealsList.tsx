import type { RfqSummary } from '@agrobridge/shared';
import { getLocale, getTranslations } from 'next-intl/server';
import { RateDealForm } from '@/components/RateDealForm';
import { RatingStars } from '@/components/RatingStars';
import { Link } from '@/i18n/navigation';
import { formatProductTitle } from '@/lib/product-title';

type Props = {
  items: RfqSummary[];
  viewerId: string;
  emptyLabel: string;
};

export async function CompletedDealsList({ items, viewerId, emptyLabel }: Props) {
  const t = await getTranslations('cabinet');
  const tr = await getTranslations('rfq');
  const locale = await getLocale();

  if (items.length === 0) {
    return <p className="empty-state">{emptyLabel}</p>;
  }

  return (
    <ul className="completed-deals">
      {items.map((item) => {
        const isBuyer = item.buyer.id === viewerId;
        const partner = isBuyer ? item.seller : item.buyer;
        const partnerName = partner.displayName || partner.email;
        const detailHref = isBuyer
          ? `/dashboard/rfqs/${item.id}`
          : `/dashboard/inbox/${item.id}`;
        const completedLabel = item.completedAt
          ? new Date(item.completedAt).toLocaleDateString(locale)
          : new Date(item.updatedAt).toLocaleDateString(locale);
        const buyerRating = isBuyer ? item.myRating : item.counterpartyRating;
        const sellerRating = isBuyer ? item.counterpartyRating : item.myRating;

        return (
          <li key={item.id} className="completed-deals__item">
            <div className="completed-deals__main">
              <Link href={detailHref} className="product-list__title">
                {formatProductTitle(item.product.title, locale)}
              </Link>
              <p className="product-list__meta">
                {tr(`statuses.${item.status}`)}
                {' · '}
                {item.quantity}
                {item.unit ? ` ${item.unit}` : ''}
                {' · '}
                <Link href={`/users/${partner.id}`}>{partnerName}</Link>
                {' · '}
                {completedLabel}
              </p>
              {item.offer ? (
                <p className="product-list__desc">
                  {tr('offerSummary', {
                    amount: item.offer.priceAmount,
                    currency: item.offer.currency,
                  })}
                </p>
              ) : null}
            </div>

            <div className="completed-deals__ratings">
              <div className="completed-deals__rating-block">
                <p className="completed-deals__rating-label">{t('deals.buyerRating')}</p>
                {buyerRating ? (
                  <>
                    <RatingStars value={buyerRating.score} showValue size="sm" />
                    {buyerRating.comment ? (
                      <p className="completed-deals__review">{buyerRating.comment}</p>
                    ) : (
                      <p className="completed-deals__review completed-deals__review--muted">
                        {t('deals.noComment')}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="completed-deals__review completed-deals__review--muted">
                    {t('deals.buyerRatingPending')}
                  </p>
                )}
              </div>

              <div className="completed-deals__rating-block">
                <p className="completed-deals__rating-label">{t('deals.sellerRating')}</p>
                {sellerRating ? (
                  <>
                    <RatingStars value={sellerRating.score} showValue size="sm" />
                    {sellerRating.comment ? (
                      <p className="completed-deals__review">{sellerRating.comment}</p>
                    ) : (
                      <p className="completed-deals__review completed-deals__review--muted">
                        {t('deals.noComment')}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="completed-deals__review completed-deals__review--muted">
                    {t('deals.sellerRatingPending')}
                  </p>
                )}
              </div>
            </div>

            {item.canRate ? (
              <div className="completed-deals__rate">
                <RateDealForm rfqId={item.id} counterpartyName={partnerName} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
