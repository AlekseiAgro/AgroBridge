import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { CabinetShell } from '@/components/CabinetShell';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/session';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function DashboardLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale });
  }

  return <CabinetShell>{children}</CabinetShell>;
}
