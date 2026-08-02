'use client';

import { RATING_MAX_SCORE, RATING_MIN_SCORE } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  rfqId: string;
  counterpartyName: string;
};

export function RateDealForm({ rfqId, counterpartyName }: Props) {
  const t = useTranslations('rating');
  const router = useRouter();
  const [score, setScore] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfqId,
          score,
          comment: String(form.get('comment') ?? ''),
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('genericError'));
        return;
      }
      router.refresh();
    } catch {
      setError(t('genericError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form rate-deal" onSubmit={onSubmit}>
      <h2 className="section-title">{t('title')}</h2>
      <p className="page__subtitle">{t('subtitle', { name: counterpartyName })}</p>
      <fieldset className="rate-deal__scores">
        <legend>{t('score')}</legend>
        <div className="rate-deal__options">
          {Array.from({ length: RATING_MAX_SCORE }, (_, index) => {
            const value = index + RATING_MIN_SCORE;
            return (
              <label key={value} className={score === value ? 'rate-deal__option rate-deal__option--active' : 'rate-deal__option'}>
                <input
                  type="radio"
                  name="score"
                  value={value}
                  checked={score === value}
                  onChange={() => setScore(value)}
                />
                <span>{value}★</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <label className="field">
        <span>{t('comment')}</span>
        <textarea name="comment" rows={3} placeholder={t('commentPlaceholder')} maxLength={1000} />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t('pleaseWait') : t('submit')}
      </button>
    </form>
  );
}
