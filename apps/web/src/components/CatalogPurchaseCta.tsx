import { getTranslations } from 'next-intl/server';
import { FloatingCta } from '@/components/FloatingCta';
import { getCurrentUser } from '@/lib/session';

export async function CatalogPurchaseCta() {
  const t = await getTranslations('catalog');
  const user = await getCurrentUser();
  const isBuyer = user?.role === 'buyer' || user?.role === 'admin';
  const href = isBuyer ? '/requests/new' : user ? '/buyers' : '/register';

  return (
    <FloatingCta
      lead={t('floatingLead')}
      text={t('floatingText')}
      cta={t('floatingCta')}
      href={href}
    />
  );
}
