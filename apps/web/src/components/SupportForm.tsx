'use client';

import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';

type Props = {
  defaultName?: string;
  defaultEmail?: string;
};

export function SupportForm({ defaultName = '', defaultEmail = '' }: Props) {
  const t = useTranslations('support');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      subject: String(data.get('subject') ?? ''),
      message: String(data.get('message') ?? ''),
    };

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { message?: string; ok?: boolean };
      if (!response.ok) {
        setError(result.message ?? t('genericError'));
        return;
      }
      setSuccess(true);
      form.reset();
    } catch {
      setError(t('genericError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form support-form" onSubmit={onSubmit}>
      <label className="field">
        <span>{t('name')}</span>
        <input
          name="name"
          type="text"
          required
          maxLength={120}
          defaultValue={defaultName}
          autoComplete="name"
        />
      </label>
      <label className="field">
        <span>{t('email')}</span>
        <input
          name="email"
          type="email"
          required
          maxLength={255}
          defaultValue={defaultEmail}
          autoComplete="email"
        />
      </label>
      <label className="field">
        <span>{t('subject')}</span>
        <input name="subject" type="text" required maxLength={160} />
      </label>
      <label className="field">
        <span>{t('message')}</span>
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={6}
          placeholder={t('messagePlaceholder')}
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{t('success')}</p> : null}

      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t('pleaseWait') : t('submit')}
      </button>
    </form>
  );
}
