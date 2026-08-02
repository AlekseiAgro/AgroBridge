'use client';

import { LOCALE_LABELS, type Locale } from '@agrobridge/shared';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function LanguageSwitcher() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname() || '/';

  return (
    <details className="language-switcher">
      <summary className="language-switcher__button" aria-label={t('language')}>
        {LOCALE_LABELS[locale as Locale]}
      </summary>
      <ul className="language-switcher__menu" role="listbox" aria-label={t('language')}>
        {routing.locales.map((code) => {
          const active = code === locale;
          return (
            <li key={code} role="option" aria-selected={active}>
              <Link
                href={pathname}
                locale={code as Locale}
                hrefLang={code}
                className={
                  active
                    ? 'language-switcher__option language-switcher__option--active'
                    : 'language-switcher__option'
                }
              >
                {LOCALE_LABELS[code]}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
