import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { Source_Sans_3, Fraunces, Noto_Sans_Georgian } from 'next/font/google';
import { routing } from '@/i18n/routing';
import '../globals.css';

const sans = Source_Sans_3({
  variable: '--font-agro-sans',
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
});

const georgian = Noto_Sans_Georgian({
  variable: '--font-agro-georgian',
  subsets: ['georgian'],
  weight: ['400', '600', '700'],
});

const display = Fraunces({
  variable: '--font-agro-display',
  subsets: ['latin', 'latin-ext'],
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${sans.variable} ${georgian.variable} ${display.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
