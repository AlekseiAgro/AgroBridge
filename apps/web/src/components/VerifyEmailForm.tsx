'use client';

import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { LogoutButton } from '@/components/LogoutButton';

type Props = {
  email: string;
  nextPath: string;
};

async function postJson<T>(url: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(data.message ?? 'Request failed');
  }
  return data;
}

export function VerifyEmailForm({ email, nextPath }: Props) {
  const t = useTranslations('verifyEmail');
  const router = useRouter();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('genericError'));
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    await run(async () => {
      const result = await postJson<{ destination: string }>('/api/verification/email/send-code');
      setMessage(t('sent', { destination: result.destination }));
    });
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await postJson('/api/verification/email/confirm', { code });
      setMessage(t('confirmed'));
      router.replace(nextPath);
      router.refresh();
    });
  }

  return (
    <div className="auth-form">
      <p className="product-list__meta">{t('sentHint', { email })}</p>

      <form onSubmit={confirm}>
        <label className="field">
          <span>{t('code')}</span>
          <input
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            minLength={6}
            required
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="product-list__meta">{message}</p> : null}

        <button className="button button--primary" type="submit" disabled={pending || code.length !== 6}>
          {pending ? t('pleaseWait') : t('confirm')}
        </button>
      </form>

      <div className="how-it-works__actions" style={{ marginTop: '1rem' }}>
        <button className="button button--ghost" type="button" disabled={pending} onClick={() => void resend()}>
          {t('resend')}
        </button>
        <LogoutButton />
      </div>
    </div>
  );
}
