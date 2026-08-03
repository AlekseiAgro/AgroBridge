'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';

type Props = {
  productId: string;
  initialWatching?: boolean;
  isLoggedIn: boolean;
};

export function HarvestWatchButton({
  productId,
  initialWatching = false,
  isLoggedIn,
}: Props) {
  const t = useTranslations('harvest');
  const router = useRouter();
  const [watching, setWatching] = useState(initialWatching);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <div className="harvest-watch">
        <Link href="/login" className="button button--primary harvest-watch__login">
          {t('loginToWatch')}
        </Link>
      </div>
    );
  }

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${productId}/watch`, {
        method: watching ? 'DELETE' : 'POST',
      });
      const data = (await response.json()) as { watching?: boolean; message?: string };
      if (!response.ok) {
        setError(data.message ?? t('watchError'));
        return;
      }
      setWatching(Boolean(data.watching));
      router.refresh();
    } catch {
      setError(t('watchError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="harvest-watch">
      <button
        type="button"
        className={watching ? 'button button--ghost' : 'button'}
        disabled={pending}
        onClick={toggle}
      >
        {pending ? t('pleaseWait') : watching ? t('unwatch') : t('watch')}
      </button>
      <p className="page__subtitle">{watching ? t('watchingHint') : t('watchHint')}</p>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
