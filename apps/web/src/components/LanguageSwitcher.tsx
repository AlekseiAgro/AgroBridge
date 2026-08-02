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
    <nav className="language-switcher" aria-label={t('language')}>
      <ul className="language-switcher__list">
        {routing.locales.map((code) => {
          const active = code === locale;
          return (
            <li key={code}>
              <Link
                href={pathname}
                locale={code as Locale}
                hrefLang={code}
                className={
                  active
                    ? 'language-switcher__link language-switcher__link--active'
                    : 'language-switcher__link'
                }
                aria-current={active ? 'true' : undefined}
              >
                {LOCALE_LABELS[code]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
