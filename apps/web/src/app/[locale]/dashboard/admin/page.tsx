import type {
  AdminDeal,
  AdminFarm,
  AdminPurchaseRequest,
  AdminSection,
  AdminStats,
  AdminUser,
  CategoryConfigItem,
  ModeratedProduct,
} from '@agrobridge/shared';
import { isAdminSection } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminActionButtons } from '@/components/AdminActionButtons';
import { CategoryAdminActions } from '@/components/CategoryAdminActions';
import { ModerationActions } from '@/components/ModerationActions';
import { RequestModerateActions } from '@/components/RequestModerateActions';
import { UserBlockActions } from '@/components/UserBlockActions';
import { Link, redirect } from '@/i18n/navigation';
import { formatRegionLabel } from '@/lib/region';
import { toPublicMediaUrl } from '@/lib/product-image';
import { formatProductDescription, formatProductTitle } from '@/lib/product-title';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    section?: string;
    status?: string;
    blocked?: string;
    registeredWithin?: string;
    registeredOn?: string;
  }>;
};

const SECTIONS: AdminSection[] = [
  'overview',
  'products',
  'farms',
  'users',
  'requests',
  'deals',
  'categories',
];

export default async function AdminDashboardPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  const section: AdminSection = isAdminSection(query.section ?? '')
    ? (query.section as AdminSection)
    : 'overview';
  const status = query.status ?? defaultStatus(section);
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (user!.role !== 'admin') redirect({ href: '/account', locale });

  const t = await getTranslations('admin');
  const tc = await getTranslations('catalog');
  const tr = await getTranslations();

  const stats = await apiRequestAuthed<AdminStats>('/admin/stats');

  return (
    <main className="cabinet-page">
      <h1>{t('title')}</h1>
      <p className="page__subtitle">{t('subtitle')}</p>

      <nav className="admin-tabs" aria-label={t('sectionsLabel')}>
        {SECTIONS.map((item) => (
          <Link
            key={item}
            href={`/dashboard/admin?section=${item}`}
            className={`admin-tab ${section === item ? 'admin-tab--active' : ''}`}
          >
            {t(`sections.${item}`)}
          </Link>
        ))}
      </nav>

      {section === 'overview' ? (
        <OverviewSection stats={stats} t={t} />
      ) : null}

      {section === 'products' ? (
        <ProductsSection
          status={status}
          locale={locale}
          t={t}
          tc={tc}
          tr={tr}
        />
      ) : null}

      {section === 'farms' ? <FarmsSection status={status} t={t} tr={tr} /> : null}

      {section === 'users' ? (
        <UsersSection
          t={t}
          blocked={query.blocked}
          registeredWithin={query.registeredWithin}
          registeredOn={query.registeredOn}
        />
      ) : null}

      {section === 'requests' ? (
        <RequestsSection status={status} t={t} tc={tc} />
      ) : null}

      {section === 'deals' ? <DealsSection status={status} t={t} /> : null}

      {section === 'categories' ? <CategoriesSection t={t} /> : null}
    </main>
  );
}

function defaultStatus(section: AdminSection) {
  if (section === 'products') return 'pending';
  if (section === 'farms') return 'pending';
  if (section === 'requests') return 'open';
  if (section === 'deals') return 'all';
  return '';
}

function OverviewSection({
  stats,
  t,
}: {
  stats: AdminStats;
  t: Awaited<ReturnType<typeof getTranslations<'admin'>>>;
}) {
  const cards: Array<{
    key: string;
    label: string;
    value: number;
    href: string;
  }> = [
    {
      key: 'pending',
      label: t('stats.pending'),
      value: stats.productsPending,
      href: '/dashboard/admin?section=products&status=pending',
    },
    {
      key: 'approved',
      label: t('stats.approved'),
      value: stats.productsApproved,
      href: '/dashboard/admin?section=products&status=approved',
    },
    {
      key: 'farmsPending',
      label: t('stats.farmsPending'),
      value: stats.farmsPendingVerification,
      href: '/dashboard/admin?section=farms&status=pending',
    },
    {
      key: 'documentsPending',
      label: t('stats.documentsPending'),
      value: stats.documentsPending,
      href: '/dashboard/admin?section=farms&status=documents',
    },
    {
      key: 'registrations7d',
      label: t('stats.registrations7d'),
      value: stats.registrationsLast7Days,
      href: '/dashboard/admin?section=users&registeredWithin=7',
    },
    {
      key: 'registrations30d',
      label: t('stats.registrations30d'),
      value: stats.registrationsLast30Days,
      href: '/dashboard/admin?section=users&registeredWithin=30',
    },
    {
      key: 'dealsCompleted',
      label: t('stats.dealsCompleted'),
      value: stats.dealsCompleted,
      href: '/dashboard/admin?section=deals&status=completed',
    },
    {
      key: 'dealsInProgress',
      label: t('stats.dealsInProgress'),
      value: stats.dealsInProgress,
      href: '/dashboard/admin?section=deals&status=accepted',
    },
    {
      key: 'users',
      label: t('stats.users'),
      value: stats.usersTotal,
      href: '/dashboard/admin?section=users',
    },
    {
      key: 'usersBlocked',
      label: t('stats.usersBlocked'),
      value: stats.usersBlocked,
      href: '/dashboard/admin?section=users&blocked=true',
    },
    {
      key: 'farms',
      label: t('stats.farms'),
      value: stats.farmsTotal,
      href: '/dashboard/admin?section=farms&status=all',
    },
    {
      key: 'requestsOpen',
      label: t('stats.requestsOpen'),
      value: stats.purchaseRequestsOpen,
      href: '/dashboard/admin?section=requests&status=open',
    },
  ];

  return (
    <>
      <dl className="admin-stats">
        {cards.map((card) => (
          <div key={card.key}>
            <Link href={card.href} className="admin-stats__link">
              <dt>{card.label}</dt>
              <dd>{card.value}</dd>
            </Link>
          </div>
        ))}
      </dl>

      <h2 className="section-title">{t('overview.registrationsTitle')}</h2>
      <ul className="admin-day-stats">
        {stats.registrationsByDay.map((row) => (
          <li key={row.date}>
            <Link
              href={`/dashboard/admin?section=users&registeredOn=${row.date}`}
              className="admin-day-stats__link"
            >
              <span>{row.date}</span>
              <strong>{row.count}</strong>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

async function ProductsSection({
  status,
  locale,
  t,
  tc,
  tr,
}: {
  status: string;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<'admin'>>>;
  tc: Awaited<ReturnType<typeof getTranslations<'catalog'>>>;
  tr: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const products = await apiRequestAuthed<ModeratedProduct[]>(
    `/admin/products?status=${encodeURIComponent(status)}`,
  );
  const tabs = ['pending', 'approved', 'rejected', 'draft'] as const;

  return (
    <>
      <div className="admin-tabs">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={`/dashboard/admin?section=products&status=${tab}`}
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
              <p className="product-list__title">
                {formatProductTitle(product.title, locale)}
              </p>
              <p className="product-list__meta">
                {product.farm
                  ? `${product.farm.name}${
                      product.farm.region
                        ? ` · ${formatRegionLabel(product.farm.region, tr) ?? product.farm.region}`
                        : ''
                    } · `
                  : ''}
                {product.owner.displayName || product.owner.email}
                {product.category
                  ? ` · ${tc(`categories.${product.category as 'fruits'}`)}`
                  : ''}
              </p>
              {product.description ? (
                <p className="product-list__desc">
                  {formatProductDescription(product.description, locale)}
                </p>
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
    </>
  );
}

async function FarmsSection({
  status,
  t,
  tr,
}: {
  status: string;
  t: Awaited<ReturnType<typeof getTranslations<'admin'>>>;
  tr: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const farms = await apiRequestAuthed<AdminFarm[]>(
    `/admin/farms?status=${encodeURIComponent(status || 'pending')}`,
  );
  const tabs = ['all', 'unverified', 'pending', 'approved', 'rejected', 'documents'] as const;

  return (
    <>
      <div className="admin-tabs">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={`/dashboard/admin?section=farms&status=${tab}`}
            className={`admin-tab ${status === tab ? 'admin-tab--active' : ''}`}
          >
            {t(`farms.tabs.${tab}`)}
          </Link>
        ))}
      </div>
      {farms.length === 0 ? (
        <p className="empty-state">{t('farms.empty')}</p>
      ) : (
        <ul className="product-list">
          {farms.map((farm) => (
            <li key={farm.id} className="product-list__item">
              <p className="product-list__title">{farm.name}</p>
              <p className="product-list__meta">
                {farm.owner.displayName || farm.owner.email}
                {farm.region
                  ? ` · ${formatRegionLabel(farm.region, tr) ?? farm.region}`
                  : ''}
                {' · '}
                {t('farms.products', { count: farm.productCount })}
                {' · '}
                {t(`farms.status.${farm.verificationStatus}`)}
              </p>
              {farm.description ? (
                <p className="product-list__desc">{farm.description}</p>
              ) : null}
              {farm.verificationNote ? (
                <p className="form-error">
                  {t('note')}: {farm.verificationNote}
                </p>
              ) : null}
              {farm.documents.length > 0 ? (
                <div style={{ marginTop: '0.75rem' }}>
                  <p className="product-list__meta">{t('farms.documents')}</p>
                  <ul className="admin-doc-list">
                    {farm.documents.map((doc) => (
                      <li key={doc.id}>
                        <a href={toPublicMediaUrl(doc.url)} target="_blank" rel="noreferrer">
                          {doc.title}
                        </a>
                        {' · '}
                        {t(`farms.docKinds.${doc.kind}`)}
                        {' · '}
                        {t(`farms.docStatus.${doc.reviewStatus}`)}
                        <div style={{ marginTop: '0.5rem' }}>
                          <AdminActionButtons
                            endpoint={`/api/admin/documents/${doc.id}`}
                            approveLabel={t('farms.approveDoc')}
                            rejectLabel={t('farms.rejectDoc')}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="product-list__meta">{t('farms.noDocuments')}</p>
              )}
              <div style={{ marginTop: '0.85rem' }}>
                <AdminActionButtons
                  endpoint={`/api/admin/farms/${farm.id}`}
                  approveLabel={t('farms.approve')}
                  rejectLabel={t('farms.reject')}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function UsersSection({
  t,
  blocked,
  registeredWithin,
  registeredOn,
}: {
  t: Awaited<ReturnType<typeof getTranslations<'admin'>>>;
  blocked?: string;
  registeredWithin?: string;
  registeredOn?: string;
}) {
  const params = new URLSearchParams();
  if (blocked) params.set('blocked', blocked);
  if (registeredWithin) params.set('registeredWithin', registeredWithin);
  if (registeredOn) params.set('registeredOn', registeredOn);
  const query = params.toString();
  const users = await apiRequestAuthed<AdminUser[]>(
    query ? `/admin/users?${query}` : '/admin/users',
  );

  const filterTabs = [
    { key: 'all', href: '/dashboard/admin?section=users', active: !blocked && !registeredWithin && !registeredOn },
    {
      key: 'blocked',
      href: '/dashboard/admin?section=users&blocked=true',
      active: blocked === 'true',
    },
    {
      key: 'last7',
      href: '/dashboard/admin?section=users&registeredWithin=7',
      active: registeredWithin === '7' && !registeredOn,
    },
    {
      key: 'last30',
      href: '/dashboard/admin?section=users&registeredWithin=30',
      active: registeredWithin === '30' && !registeredOn,
    },
  ] as const;

  return (
    <>
      <div className="admin-tabs">
        {filterTabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`admin-tab ${tab.active ? 'admin-tab--active' : ''}`}
          >
            {t(`users.filters.${tab.key}`)}
          </Link>
        ))}
      </div>
      {registeredOn ? (
        <p className="page__subtitle">{t('users.registeredOn', { date: registeredOn })}</p>
      ) : null}
      {users.length === 0 ? (
        <p className="empty-state">{t('users.empty')}</p>
      ) : (
        <ul className="product-list">
          {users.map((item) => (
            <li key={item.id} className="product-list__item">
              <p className="product-list__title">
                {item.displayName || item.email}
                {item.blockedAt ? ` · ${t('users.blockedBadge')}` : ''}
              </p>
              <p className="product-list__meta">
                {item.email} · {t(`users.roles.${item.role}`)} ·{' '}
                {t('users.registered', {
                  date: new Date(item.createdAt).toLocaleDateString(),
                })}
                {' · '}
                {t('users.deals', { count: item.completedDeals })}
                {item.farm ? ` · ${item.farm.name}` : ''}
              </p>
              {item.blockedReason ? (
                <p className="form-error">
                  {t('note')}: {item.blockedReason}
                </p>
              ) : null}
              {item.role !== 'admin' ? (
                <div style={{ marginTop: '0.85rem' }}>
                  <UserBlockActions userId={item.id} blocked={Boolean(item.blockedAt)} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function RequestsSection({
  status,
  t,
  tc,
}: {
  status: string;
  t: Awaited<ReturnType<typeof getTranslations<'admin'>>>;
  tc: Awaited<ReturnType<typeof getTranslations<'catalog'>>>;
}) {
  const requests = await apiRequestAuthed<AdminPurchaseRequest[]>(
    `/admin/purchase-requests?status=${encodeURIComponent(status || 'open')}`,
  );
  const tabs = ['open', 'fulfilled', 'closed', 'cancelled'] as const;

  return (
    <>
      <div className="admin-tabs">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={`/dashboard/admin?section=requests&status=${tab}`}
            className={`admin-tab ${status === tab ? 'admin-tab--active' : ''}`}
          >
            {t(`requests.tabs.${tab}`)}
          </Link>
        ))}
      </div>
      {requests.length === 0 ? (
        <p className="empty-state">{t('requests.empty')}</p>
      ) : (
        <ul className="product-list">
          {requests.map((request) => (
            <li key={request.id} className="product-list__item">
              <p className="product-list__title">{request.title}</p>
              <p className="product-list__meta">
                {request.buyer.displayName || request.buyer.email}
                {' · '}
                {tc(`categories.${request.category as 'fruits'}`)}
                {' · '}
                {request.quantity}
                {request.unit ? ` ${request.unit}` : ''}
                {' · '}
                {t('requests.quotes', { count: request.quoteCount })}
              </p>
              {request.moderationNote ? (
                <p className="form-error">
                  {t('note')}: {request.moderationNote}
                </p>
              ) : null}
              {request.status === 'open' ? (
                <div style={{ marginTop: '0.85rem' }}>
                  <RequestModerateActions requestId={request.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function DealsSection({
  status,
  t,
}: {
  status: string;
  t: Awaited<ReturnType<typeof getTranslations<'admin'>>>;
}) {
  const activeStatus = status || 'all';
  const deals = await apiRequestAuthed<AdminDeal[]>(
    activeStatus === 'all'
      ? '/admin/deals'
      : `/admin/deals?status=${encodeURIComponent(activeStatus)}`,
  );
  const tabs = ['all', 'completed', 'accepted'] as const;

  return (
    <>
      <div className="admin-tabs">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={`/dashboard/admin?section=deals&status=${tab}`}
            className={`admin-tab ${activeStatus === tab ? 'admin-tab--active' : ''}`}
          >
            {t(`deals.tabs.${tab}`)}
          </Link>
        ))}
      </div>
      {deals.length === 0 ? (
        <p className="empty-state">{t('deals.empty')}</p>
      ) : (
        <ul className="product-list">
          {deals.map((deal) => (
            <li key={`${deal.kind}-${deal.id}`} className="product-list__item">
              <p className="product-list__title">{deal.title}</p>
              <p className="product-list__meta">
                {t(`deals.kinds.${deal.kind}`)} · {deal.status}
                {' · '}
                {t('deals.buyer')}: {deal.buyer.displayName || deal.buyer.email}
                {deal.seller
                  ? ` · ${t('deals.seller')}: ${deal.seller.farmName || deal.seller.displayName || deal.seller.email}`
                  : ''}
                {deal.completedAt
                  ? ` · ${new Date(deal.completedAt).toLocaleDateString()}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function CategoriesSection({
  t,
}: {
  t: Awaited<ReturnType<typeof getTranslations<'admin'>>>;
}) {
  const categories = await apiRequestAuthed<CategoryConfigItem[]>('/admin/categories');
  return (
    <>
      <p className="page__subtitle">{t('categories.hint')}</p>
      <CategoryAdminActions categories={categories} />
    </>
  );
}
