'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';

type Props = {
  productId: string;
  initialWatching?: boolean;
  isLoggedIn: boolean;
  isOwner?: boolean;
  /** Sold-out listings reuse this control instead of the quote form. */
  unavailable?: boolean;
  /** Signed-in user who still needs the existing email verification flow. */
  verifyHref?: string;
};

export function HarvestWatchButton({
  productId,
  initialWatching = false,
  isLoggedIn,
  isOwner = false,
  unavailable = false,
  verifyHref,
}: Props) {
  const t = useTranslations('harvest');
  const tVerify = useTranslations('verifyEmail');
  const router = useRouter();
  const [watching, setWatching] = useState(initialWatching);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <div className="harvest-watch">
        <Link href="/login" className="button button--primary harvest-watch__login">
          {unavailable ? t('soldOutLogin') : t('loginToWatch')}
        </Link>
      </div>
    );
  }

  if (isOwner) {
    return (
      <div className="harvest-watch">
        <p className="page__subtitle">{t('ownerWatchHint')}</p>
      </div>
    );
  }

  if (verifyHref) {
    return (
      <div className="harvest-watch">
        <Link href={verifyHref} className="button button--primary harvest-watch__login">
          {tVerify('confirm')}
        </Link>
        <p className="page__subtitle">{tVerify('productGate')}</p>
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
        className={watching ? 'button button--ghost harvest-watch__button' : 'button button--primary harvest-watch__button'}
        disabled={pending}
        onClick={() => {
          void toggle();
        }}
      >
        {pending
          ? t('pleaseWait')
          : watching
            ? t('unwatch')
            : unavailable
              ? t('notifyWhenAvailable')
              : t('watch')}
      </button>
      <p className="page__subtitle">
        {unavailable
          ? watching
            ? t('soldOutWatching')
            : t('soldOutWatchHint')
          : watching
            ? t('watchingHint')
            : t('watchHint')}
      </p>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
