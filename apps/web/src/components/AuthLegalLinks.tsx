import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function AuthLegalLinks() {
  const t = await getTranslations('footer');

  return (
    <nav className="auth-legal-links" aria-label={t('legal')}>
      <Link href="/legal">{t('legalInformation')}</Link>
      <Link href="/terms">{t('terms')}</Link>
      <Link href="/privacy">{t('privacy')}</Link>
    </nav>
  );
}
