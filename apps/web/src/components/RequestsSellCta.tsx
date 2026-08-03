import { getTranslations } from 'next-intl/server';
import { FloatingCta } from '@/components/FloatingCta';
import { getCurrentUser } from '@/lib/session';

export async function RequestsSellCta() {
  const t = await getTranslations('purchaseRequests');
  const user = await getCurrentUser();
  const isFarmer = user?.role === 'farmer' || user?.role === 'admin';
  const href = isFarmer ? '/dashboard/products/new' : user ? '/sellers' : '/register';

  return (
    <FloatingCta
      lead={t('floatingLead')}
      text={t('floatingText')}
      cta={t('floatingCta')}
      href={href}
      variant="accent"
    />
  );
}
