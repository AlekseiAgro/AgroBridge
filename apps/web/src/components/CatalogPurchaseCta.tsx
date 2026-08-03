import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/session';

export async function CatalogPurchaseCta() {
  const t = await getTranslations('catalog');
  const user = await getCurrentUser();
  const isBuyer = user?.role === 'buyer' || user?.role === 'admin';
  const href = isBuyer ? '/requests/new' : user ? '/buyers' : '/register';

  return (
    <aside className="catalog-cta" aria-label={t('floatingCta')}>
      <div className="catalog-cta__inner">
        <div className="catalog-cta__copy">
          <p className="catalog-cta__lead">{t('floatingLead')}</p>
          <p className="catalog-cta__text">{t('floatingText')}</p>
        </div>
        <Link href={href} className="button button--primary catalog-cta__button">
          {t('floatingCta')}
        </Link>
      </div>
    </aside>
  );
}
