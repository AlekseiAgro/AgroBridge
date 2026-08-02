'use client';

import {
  GEORGIA_REGIONS,
  isGeorgiaRegion,
  type FarmDetail,
} from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  initial?: Pick<FarmDetail, 'name' | 'region' | 'description'> | null;
  mode: 'create' | 'edit';
};

export function FarmForm({ initial, mode }: Props) {
  const t = useTranslations('farm');
  const tr = useTranslations();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get('name') ?? ''),
      region: String(form.get('region') ?? ''),
      description: String(form.get('description') ?? ''),
    };

    try {
      const response = await fetch(mode === 'create' ? '/api/farms' : '/api/farms/me', {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('genericError'));
        return;
      }
      router.replace('/dashboard/farm');
      router.refresh();
    } catch {
      setError(t('genericError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label className="field">
        <span>{t('name')}</span>
        <input name="name" required minLength={2} defaultValue={initial?.name ?? ''} />
      </label>
      <label className="field">
        <span>{t('region')}</span>
        <select name="region" defaultValue={initial?.region ?? ''}>
          <option value="">{t('regionPlaceholder')}</option>
          {initial?.region && !isGeorgiaRegion(initial.region) ? (
            <option value={initial.region}>{initial.region}</option>
          ) : null}
          {GEORGIA_REGIONS.map((value) => (
            <option key={value} value={value}>
              {tr(`regions.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('description')}</span>
        <textarea name="description" rows={5} defaultValue={initial?.description ?? ''} />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t('pleaseWait') : mode === 'create' ? t('createSubmit') : t('saveSubmit')}
      </button>
    </form>
  );
}
