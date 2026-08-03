'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

type Props = {
  initialDisplayName: string | null;
};

export function EditDisplayNameForm({ initialDisplayName }: Props) {
  const t = useTranslations('cabinet');
  const ta = useTranslations('auth');
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch('/api/cabinet/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      });
      const data = (await response.json()) as {
        displayName?: string | null;
        message?: string;
      };
      if (!response.ok) {
        setError(data.message ?? t('displayNameError'));
        return;
      }
      setDisplayName(data.displayName ?? '');
      setEditing(false);
      setSaved(true);
      router.refresh();
    } catch {
      setError(t('displayNameError'));
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <div className="profile-edit-row">
        <p className="user-card__meta">
          <span className="profile-edit-row__label">{t('displayNameLabel')}: </span>
          {displayName.trim() || t('noDisplayName')}
        </p>
        <button
          type="button"
          className="button button--ghost profile-edit-row__button"
          onClick={() => {
            setEditing(true);
            setSaved(false);
            setError(null);
          }}
        >
          {t('displayNameEdit')}
        </button>
        {saved ? <p className="product-list__meta">{t('displayNameSaved')}</p> : null}
      </div>
    );
  }

  return (
    <form className="profile-edit-form" onSubmit={onSubmit}>
      <label className="field">
        <span>{t('displayNameLabel')}</span>
        <input
          type="text"
          maxLength={120}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder={ta('displayName')}
          autoComplete="name"
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="how-it-works__actions">
        <button className="button button--primary" type="submit" disabled={pending}>
          {pending ? ta('pleaseWait') : t('displayNameSave')}
        </button>
        <button
          className="button button--ghost"
          type="button"
          disabled={pending}
          onClick={() => {
            setEditing(false);
            setDisplayName(initialDisplayName ?? '');
            setError(null);
          }}
        >
          {t('displayNameCancel')}
        </button>
      </div>
    </form>
  );
}
