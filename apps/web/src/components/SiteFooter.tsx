import { getTranslations } from 'next-intl/server';
import { BrandLogo } from '@/components/BrandLogo';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/session';

export async function SiteFooter() {
  const t = await getTranslations('footer');
  const tn = await getTranslations('nav');
  const user = await getCurrentUser();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Link href="/" className="site-footer__logo" aria-label="AgroBridge">
            <BrandLogo variant="horizontal" />
          </Link>
          <p className="site-footer__tagline">{t('tagline')}</p>
          <Link href="/support" className="button button--primary site-footer__support">
            {t('support')}
          </Link>
        </div>

        <div className="site-footer__columns">
          <nav className="site-footer__col" aria-label={t('explore')}>
            <p className="site-footer__heading">{t('explore')}</p>
            <Link href="/catalog">{tn('catalog')}</Link>
            <Link href="/how-it-works">{tn('howItWorks')}</Link>
            <Link href="/support">{t('support')}</Link>
          </nav>

          <nav className="site-footer__col" aria-label={t('account')}>
            <p className="site-footer__heading">{t('account')}</p>
            {user ? (
              <Link href="/account">{tn('account')}</Link>
            ) : (
              <>
                <Link href="/login">{tn('login')}</Link>
                <Link href="/register">{tn('register')}</Link>
              </>
            )}
          </nav>
        </div>
      </div>

      <p className="site-footer__copy">{t('copyright', { year })}</p>
    </footer>
  );
}
