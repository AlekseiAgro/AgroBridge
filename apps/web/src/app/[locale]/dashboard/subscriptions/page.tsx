import { setRequestLocale } from 'next-intl/server';
import { LegacySubscriptionsRedirect } from './legacy-redirect';
import { requireVerifiedUser } from '@/lib/require-verified-user';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LegacySubscriptionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireVerifiedUser(locale, '/account/settings');

  return <LegacySubscriptionsRedirect />;
}
