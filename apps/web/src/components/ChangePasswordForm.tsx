'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';

export function ChangePasswordForm() {
  const t = useTranslations('auth');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get('currentPassword') ?? '');
    const newPassword = String(data.get('newPassword') ?? '');
    const confirm = String(data.get('confirmNewPassword') ?? '');

    if (newPassword !== confirm) {
      setError(t('passwordMismatch'));
      return;
    }

    if (newPassword.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await response.json()) as { message?: string; ok?: boolean };
      if (!response.ok) {
        setError(payload.message ?? t('genericError'));
        return;
      }
      form.reset();
      setSuccess(t('passwordChanged'));
    } catch {
      setError(t('genericError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label className="field">
        <span>{t('currentPassword')}</span>
        <input
          name="currentPassword"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="current-password"
        />
      </label>
      <label className="field">
        <span>{t('newPassword')}</span>
        <input
          name="newPassword"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>
      <label className="field">
        <span>{t('confirmNewPassword')}</span>
        <input
          name="confirmNewPassword"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}

      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t('pleaseWait') : t('changePasswordSubmit')}
      </button>
    </form>
  );
}
