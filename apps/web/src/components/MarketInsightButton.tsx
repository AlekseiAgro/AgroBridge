'use client';

import type { ProductMarketInsight } from '@agrobridge/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';

type Props = {
  productId: string;
};

export function MarketInsightButton({ productId }: Props) {
  const t = useTranslations('marketInsight');
  const locale = useLocale();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<ProductMarketInsight | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function onClick(event: MouseEvent) {
      if (event.target === dialogRef.current) {
        dialogRef.current?.close();
      }
    }
    dialog.addEventListener('click', onClick);
    return () => dialog.removeEventListener('click', onClick);
  }, []);

  async function openInsight() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    if (insight) return;

    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/products/${productId}/market-insight?locale=${encodeURIComponent(locale)}`,
      );
      const data = (await response.json()) as ProductMarketInsight & { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('error'));
        return;
      }
      setInsight(data);
    } catch {
      setError(t('error'));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="market-insight-trigger" onClick={openInsight}>
        <span aria-hidden>✨</span>
        {t('button')}
      </button>

      <dialog ref={dialogRef} className="market-insight-dialog" aria-labelledby={titleId}>
        <div className="market-insight-dialog__card">
          <div className="market-insight-dialog__head">
            <h2 id={titleId} className="section-title">
              {t('title')}
            </h2>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => dialogRef.current?.close()}
            >
              {t('close')}
            </button>
          </div>

          {pending ? <p className="page__subtitle">{t('loading')}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}

          {insight ? (
            <>
              <p className="market-insight-dialog__summary">{insight.summary}</p>
              <ul className="market-insight-dialog__highlights">
                {insight.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="market-insight-dialog__disclaimer">{t('disclaimer')}</p>
            </>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
