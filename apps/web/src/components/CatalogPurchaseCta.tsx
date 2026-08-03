import { getTranslations } from 'next-intl/server';
import { FloatingCta } from '@/components/FloatingCta';

export async function CatalogPurchaseCta() {
  const t = await getTranslations('catalog');
  // Always open the create-request form; the page handles login / buyer role.
  const href = '/requests/new';

  return (
    <FloatingCta
      lead={t('floatingLead')}
      text={t('floatingText')}
      cta={t('floatingCta')}
      href={href}
    />
  );
}
