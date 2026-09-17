import type { FarmDetail, ProducerVerificationStatus, RatingSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FarmDocumentsManager } from '@/components/FarmDocumentsManager';
import { FarmForm } from '@/components/FarmForm';
import {
  FarmCancelButton,
  FarmEditButton,
  FarmOwnerEditForm,
  FarmOwnerEditor,
  FarmOwnerView,
  FarmOwnerWorkspace,
} from '@/components/FarmOwnerWorkspace';
import { FarmPhotosManager } from '@/components/FarmPhotosManager';
import { FarmProfileView } from '@/components/FarmProfileView';
import { ProducerVerificationSection } from '@/components/ProducerVerificationSection';
import { VerificationLoadError } from '@/components/VerificationLoadError';
import { Link, redirect } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api';
import { toPublicFarmProfile } from '@/lib/farm-profile';
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
  let verificationUnavailable = false;
  if (farm) {
    try {
      verification = await apiRequestAuthed<ProducerVerificationStatus>('/verification/me');
    } catch {
      verification = null;
      verificationUnavailable = true;
    }
  }

  if (!farm) {
    return (
      <main className="cabinet-page cabinet-page--narrow">
        <h1>{t('createTitle')}</h1>
        <p className="page__subtitle">{t('dashboardSubtitle')}</p>
        <FarmForm mode="create" initial={null} />
      </main>
    );
  }

  let publicFarm: FarmDetail;
  try {
    publicFarm = await apiRequest<FarmDetail>(`/farms/${farm.id}`);
  } catch {
    publicFarm = toPublicFarmProfile(farm);
  }

  let ownerRating: RatingSummary = { average: null, count: 0 };
  try {
    ownerRating = await apiRequest<RatingSummary>(`/users/${farm.owner.id}/rating`);
  } catch {
    ownerRating = { average: null, count: 0 };
  }

  const formInitial = {
    name: farm.name,
    region: farm.region,
    description: farm.description,
    foundedYear: farm.foundedYear,
    farmSizeHectares: farm.farmSizeHectares,
    ownershipType: farm.ownershipType,
    exportMarkets: farm.exportMarkets,
    history: farm.history,
  };

  return (
    <FarmOwnerWorkspace>
      <FarmOwnerView>
        <main className="cabinet-page">
          <FarmProfileView
            farm={publicFarm}
            locale={locale}
            ownerRating={ownerRating}
            showOwnerLink={false}
            actions={<FarmEditButton>{t('editFarm')}</FarmEditButton>}
          />
          {verification ? <ProducerVerificationSection initial={verification} /> : null}
          {verificationUnavailable ? <VerificationLoadError /> : null}
          <p className="auth-card__footer">
            <Link href={`/farms/${farm.id}`}>{t('viewPublic')}</Link>
            {' · '}
            <Link href="/dashboard/products">{t('manageProducts')}</Link>
          </p>
        </main>
      </FarmOwnerView>
      <FarmOwnerEditor>
        <main className="cabinet-page cabinet-page--narrow">
          <div className="farm-profile__toolbar">
            <div>
              <h1>{t('editTitle')}</h1>
              <p className="field-hint">{t('cancelHint')}</p>
            </div>
            <FarmCancelButton>{t('cancelEdit')}</FarmCancelButton>
          </div>
          <p className="page__subtitle">{t('dashboardSubtitle')}</p>
          <FarmOwnerEditForm initial={formInitial} />
          <FarmPhotosManager initialPhotos={farm.photos ?? []} />
          <FarmDocumentsManager initialDocuments={farm.documents ?? []} />
        </main>
      </FarmOwnerEditor>
    </FarmOwnerWorkspace>
  );
}
