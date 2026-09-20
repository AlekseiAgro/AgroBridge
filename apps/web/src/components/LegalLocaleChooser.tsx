import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

type Props = {
  href: '/legal' | '/terms' | '/privacy';
};

export async function LegalLocaleChooser({ href }: Props) {
  const t = await getTranslations('legal');

  return (
    <section className="legal-page__chooser" aria-labelledby="legal-locale-chooser-title">
      <h2 id="legal-locale-chooser-title">{t('availableLocalesTitle')}</h2>
      <p>{t('availableLocalesBody')}</p>
      <p className="legal-page__chooser-links">
        <Link href={href} locale="ka">
          {t('openGeorgian')}
        </Link>
        <Link href={href} locale="en">
          {t('openEnglish')}
        </Link>
      </p>
    </section>
  );
}
