import type { ReactNode } from 'react';
import { CabinetShell } from '@/components/CabinetShell';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getCurrentUser } from '@/lib/session';

type Props = {
  children: ReactNode;
};

/**
 * Marketplace routes that are public for guests but part of the cabinet
 * workflow once the user is signed in and verified.
 */
export async function CabinetOrPublicShell({ children }: Props) {
  const user = await getCurrentUser();

  if (user?.emailVerified) {
    return <CabinetShell>{children}</CabinetShell>;
  }

  return (
    <div className="page">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
