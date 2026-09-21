import { DEFAULT_LOCALE } from '@agrobridge/shared';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { NotFoundPanel } from '@/components/NotFoundPanel';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { resolveRequestLocale } from '@/lib/request-locale';
import './globals.css';

export default async function RootNotFound() {
  const locale = await resolveRequestLocale(DEFAULT_LOCALE);
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div className="page">
            <SiteHeader />
            <main className="page__main">
              <NotFoundPanel />
            </main>
            <SiteFooter />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
