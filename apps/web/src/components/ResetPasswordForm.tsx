'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  token: string;
};

export function ResetPasswordForm({ token }: Props) {
  const t = useTranslations('auth');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirmPassword') ?? '');

    if (password !== confirm) {
      setError(t('passwordMismatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = (await response.json()) as { message?: string; ok?: boolean };
      if (!response.ok) {
        setError(data.message ?? t('resetPasswordInvalid'));
        return;
      }
      setDone(true);
    } catch {
      setError(t('genericError'));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return <p className="form-success">{t('resetPasswordSuccess')}</p>;
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label className="field">
        <span>{t('newPassword')}</span>
        <input
          name="password"
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
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t('pleaseWait') : t('resetPasswordSubmit')}
      </button>
    </form>
  );
}
