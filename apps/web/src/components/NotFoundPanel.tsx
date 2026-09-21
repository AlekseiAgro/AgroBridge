import { getTranslations } from 'next-intl/server';
import { BrandLogo } from '@/components/BrandLogo';
import { Link } from '@/i18n/navigation';

export async function NotFoundPanel() {
  const t = await getTranslations('notFound');
  const tn = await getTranslations('nav');

  return (
    <section className="empty-panel empty-panel--not-found">
      <p className="empty-panel__brand">
        <BrandLogo />
      </p>
      <h1 className="empty-panel__title">{t('title')}</h1>
      <p className="empty-panel__body">{t('body')}</p>
      <div className="empty-panel__actions">
        <Link href="/" className="button button--primary">
          {t('home')}
        </Link>
        <Link href="/catalog" className="button button--ghost">
          {tn('catalog')}
        </Link>
        <Link href="/requests" className="button button--ghost">
          {tn('purchaseRequests')}
        </Link>
      </div>
    </section>
  );
}
