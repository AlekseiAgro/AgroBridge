'use client';

import { LOCALE_LABELS, isLocale, type Locale } from '@agrobridge/shared';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/navigation';
import { localeSwitchHref } from '@/lib/locale-switch-href';
import { routing } from '@/i18n/routing';

function GlobeIcon() {
  return (
    <svg
      className="language-switcher__icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M3.5 12h17M12 3.5c2.4 2.6 3.6 5.4 3.6 8.5s-1.2 5.9-3.6 8.5c-2.4-2.6-3.6-5.4-3.6-8.5s1.2-5.9 3.6-8.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M5.2 7.5h13.6M5.2 16.5h13.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LanguageSwitcherMenu({ search }: { search: string }) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname() || '/';
  const href = localeSwitchHref(pathname, search);
  const currentLabel = isLocale(locale) ? LOCALE_LABELS[locale] : locale.toUpperCase();

  return (
    <details className="language-switcher">
      <summary
        className="language-switcher__button"
        aria-label={`${t('language')}: ${currentLabel}`}
        aria-haspopup="menu"
      >
        <GlobeIcon />
        <span className="language-switcher__code">{locale.toUpperCase()}</span>
      </summary>
      <ul className="language-switcher__menu" role="menu" aria-label={t('language')}>
        {routing.locales.map((code) => {
          const active = code === locale;
          return (
            <li key={code}>
              <Link
                href={href}
                locale={code as Locale}
                hrefLang={code}
                role="menuitem"
                aria-current={active ? 'true' : undefined}
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

function LanguageSwitcherWithSearch() {
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  return <LanguageSwitcherMenu search={search ? `?${search}` : ''} />;
}

export function LanguageSwitcher() {
  return (
    <Suspense fallback={<LanguageSwitcherMenu search="" />}>
      <LanguageSwitcherWithSearch />
    </Suspense>
  );
}
