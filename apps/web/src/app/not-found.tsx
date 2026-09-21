import { DEFAULT_LOCALE } from '@agrobridge/shared';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { NotFoundPanel } from '@/components/NotFoundPanel';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import './globals.css';

export default async function RootNotFound() {
  setRequestLocale(DEFAULT_LOCALE);
  const messages = await getMessages();

  return (
    <html lang={DEFAULT_LOCALE}>
      <body>
        <NextIntlClientProvider locale={DEFAULT_LOCALE} messages={messages}>
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
