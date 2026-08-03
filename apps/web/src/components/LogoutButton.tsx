'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  redirectTo?: string;
};

export function LogoutButton({ redirectTo = '/login' }: Props) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <button className="button button--ghost" type="button" onClick={onLogout} disabled={pending}>
      {pending ? t('pleaseWait') : t('logout')}
    </button>
  );
}
