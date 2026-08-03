import type { FarmDetail, ProducerVerificationStatus } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FarmDocumentsManager } from '@/components/FarmDocumentsManager';
import { FarmForm } from '@/components/FarmForm';
import { FarmPhotosManager } from '@/components/FarmPhotosManager';
import { ProducerVerificationPanel } from '@/components/ProducerVerificationPanel';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { Link, redirect } from '@/i18n/navigation';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardFarmPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale });
  }

  const t = await getTranslations('farm');
  let farm: FarmDetail | null = null;
  let verification: ProducerVerificationStatus | null = null;
  try {
    farm = await apiRequestAuthed<FarmDetail | null>('/farms/me');
  } catch {
    farm = null;
  }
  if (farm) {
    try {
      verification = await apiRequestAuthed<ProducerVerificationStatus>('/verification/me');
    } catch {
      verification = null;
    }
  }

  return (
    <main className="cabinet-page cabinet-page--narrow">
      <h1>{farm ? t('editTitle') : t('createTitle')}</h1>
      <p className="page__subtitle">{t('dashboardSubtitle')}</p>
      {farm ? (
        <p className="product-list__meta farm-verification-line">
          {t('verification.label')}: {t(`verification.farmStatus.${farm.verificationStatus}`)}
          <VerifiedBadge verified={farm.verified} />
        </p>
      ) : null}
      <FarmForm
        mode={farm ? 'edit' : 'create'}
        initial={
          farm
            ? {
                name: farm.name,
                region: farm.region,
                description: farm.description,
                foundedYear: farm.foundedYear,
                farmSizeHectares: farm.farmSizeHectares,
                ownershipType: farm.ownershipType,
                exportMarkets: farm.exportMarkets,
                history: farm.history,
              }
            : null
        }
      />
      {farm ? <FarmPhotosManager initialPhotos={farm.photos ?? []} /> : null}
      {farm && verification ? <ProducerVerificationPanel initial={verification} /> : null}
      {farm ? (
        <>
          <FarmDocumentsManager initialDocuments={farm.documents ?? []} />
          <p className="auth-card__footer">
            <Link href={`/farms/${farm.id}`}>{t('viewPublic')}</Link>
            {' · '}
            <Link href="/dashboard/products">{t('manageProducts')}</Link>
          </p>
        </>
      ) : null}
    </main>
  );
}
