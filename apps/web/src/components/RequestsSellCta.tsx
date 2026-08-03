import { canTrade } from '@agrobridge/shared';
import { getTranslations } from 'next-intl/server';
import { FloatingCta } from '@/components/FloatingCta';
import { getCurrentUser } from '@/lib/session';

export async function RequestsSellCta() {
  const t = await getTranslations('purchaseRequests');
  const user = await getCurrentUser();
  const trader = Boolean(user && canTrade(user.role));
  const href = trader ? '/dashboard/products/new' : '/register';

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
