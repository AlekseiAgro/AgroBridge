import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { CabinetShell } from '@/components/CabinetShell';
import { requireVerifiedUser } from '@/lib/require-verified-user';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function DashboardLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireVerifiedUser(locale, '/account');

  return <CabinetShell>{children}</CabinetShell>;
}
