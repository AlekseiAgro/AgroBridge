import type { AdminStats, ModeratedProduct } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ModerationActions } from '@/components/ModerationActions';
import { SiteHeader } from '@/components/SiteHeader';
import { Link, redirect } from '@/i18n/navigation';
import { formatRegionLabel } from '@/lib/region';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

export default async function AdminDashboardPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { status = 'pending' } = await searchParams;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (user!.role !== 'admin') redirect({ href: '/account', locale });

  const t = await getTranslations('admin');
  const tc = await getTranslations('catalog');
  const tr = await getTranslations();

  const [stats, products] = await Promise.all([
    apiRequestAuthed<AdminStats>('/admin/stats'),
    apiRequestAuthed<ModeratedProduct[]>(
      `/admin/products?status=${encodeURIComponent(status)}`,
    ),
  ]);

  const tabs = ['pending', 'approved', 'rejected', 'draft'] as const;

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main">
        <h1>{t('title')}</h1>
        <p className="page__subtitle">{t('subtitle')}</p>

        <dl className="admin-stats">
          <div>
            <dt>{t('stats.pending')}</dt>
            <dd>{stats.productsPending}</dd>
          </div>
          <div>
            <dt>{t('stats.approved')}</dt>
            <dd>{stats.productsApproved}</dd>
          </div>
          <div>
            <dt>{t('stats.rejected')}</dt>
            <dd>{stats.productsRejected}</dd>
          </div>
          <div>
            <dt>{t('stats.farms')}</dt>
            <dd>{stats.farmsTotal}</dd>
          </div>
          <div>
            <dt>{t('stats.users')}</dt>
            <dd>{stats.usersTotal}</dd>
          </div>
        </dl>

        <div className="admin-tabs">
          {tabs.map((tab) => (
            <Link
              key={tab}
              href={`/dashboard/admin?status=${tab}`}
              className={`admin-tab ${status === tab ? 'admin-tab--active' : ''}`}
            >
              {t(`tabs.${tab}`)}
            </Link>
          ))}
        </div>

        {products.length === 0 ? (
          <p className="empty-state">{t('empty')}</p>
        ) : (
          <ul className="product-list">
            {products.map((product) => (
              <li key={product.id} className="product-list__item">
                <p className="product-list__title">{product.title}</p>
                <p className="product-list__meta">
                  {product.farm.name}
                  {product.farm.region
                    ? ` · ${formatRegionLabel(product.farm.region, tr) ?? product.farm.region}`
                    : ''}
                  {' · '}
                  {product.farm.owner.displayName || product.farm.owner.email}
                  {product.category
                    ? ` · ${tc(`categories.${product.category as 'fruits'}`)}`
                    : ''}
                </p>
                {product.description ? (
                  <p className="product-list__desc">{product.description}</p>
                ) : null}
                {product.moderationNote ? (
                  <p className="form-error">
                    {t('note')}: {product.moderationNote}
                  </p>
                ) : null}
                <div style={{ marginTop: '0.85rem' }}>
                  <ModerationActions productId={product.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
