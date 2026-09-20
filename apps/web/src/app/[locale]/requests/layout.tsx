import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { CabinetOrPublicShell } from '@/components/CabinetOrPublicShell';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function RequestsLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <CabinetOrPublicShell>{children}</CabinetOrPublicShell>;
}
