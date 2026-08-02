import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProductForm } from '@/components/ProductForm';
import { SiteHeader } from '@/components/SiteHeader';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NewProductPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale });
  }
  if (user!.role !== 'farmer' && user!.role !== 'admin') {
    redirect({ href: '/account', locale });
  }

  const t = await getTranslations('product');

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main narrow">
        <h1>{t('createTitle')}</h1>
        <p className="page__subtitle">{t('createSubtitle')}</p>
        <ProductForm mode="create" />
      </main>
    </div>
  );
}
