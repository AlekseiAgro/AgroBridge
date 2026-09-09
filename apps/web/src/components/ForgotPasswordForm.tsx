'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { message?: string; ok?: boolean };
      if (!response.ok) {
        setError(data.message ?? t('genericError'));
        return;
      }
      setSent(true);
    } catch {
      setError(t('genericError'));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return <p className="form-success">{t('forgotPasswordSent')}</p>;
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label className="field">
        <span>{t('email')}</span>
        <input name="email" type="email" required autoComplete="email" maxLength={255} />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t('pleaseWait') : t('forgotPasswordSubmit')}
      </button>
    </form>
  );
}
