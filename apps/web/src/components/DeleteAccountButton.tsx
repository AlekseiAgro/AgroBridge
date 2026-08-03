'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

type Step = 'idle' | 'codeSent';

export function DeleteAccountButton({ email }: { email: string }) {
  const t = useTranslations('cabinet');
  const ta = useTranslations('auth');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let data: (T & { message?: string }) | null = null;
    if (text) {
      try {
        data = JSON.parse(text) as T & { message?: string };
      } catch {
        throw new Error(t('deleteAccountError'));
      }
    }
    if (!response.ok) {
      throw new Error(data?.message ?? t('deleteAccountError'));
    }
    return (data ?? {}) as T;
  }

  async function sendCode() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await postJson<{ destination: string }>('/api/cabinet/me/delete/request', {
        password,
      });
      setStep('codeSent');
      setMessage(t('deleteAccountCodeSent', { email: result.destination || email }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('deleteAccountError'));
    } finally {
      setPending(false);
    }
  }

  async function onRequestCode(event: FormEvent) {
    event.preventDefault();
    await sendCode();
  }

  async function onConfirmDelete(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm(t('deleteAccountConfirm'))) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      await postJson('/api/cabinet/me/delete/confirm', {
        password,
        code,
      });
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('deleteAccountError'));
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="cabinet-danger__trigger">
        <button className="button button--danger-quiet" type="button" onClick={() => setOpen(true)}>
          {t('deleteAccount')}
        </button>
        <p className="cabinet-danger__hint">{t('deleteAccountHint')}</p>
      </div>
    );
  }

  return (
    <div className="auth-form" style={{ marginTop: '0.75rem' }}>
      <p className="product-list__meta">{t('deleteAccountFlowHint', { email })}</p>

      {step === 'idle' ? (
        <form onSubmit={onRequestCode}>
          <label className="field">
            <span>{ta('password')}</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="how-it-works__actions">
            <button className="button button--primary" type="submit" disabled={pending}>
              {pending ? ta('pleaseWait') : t('deleteAccountSendCode')}
            </button>
            <button
              className="button button--ghost"
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setPassword('');
                setError(null);
                setMessage(null);
              }}
            >
              {t('deleteAccountCancel')}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={onConfirmDelete}>
          {message ? <p className="product-list__meta">{message}</p> : null}
          <label className="field">
            <span>{ta('password')}</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="field">
            <span>{t('deleteAccountCode')}</span>
            <input
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
          <div className="how-it-works__actions">
            <button
              className="button button--danger"
              type="submit"
              disabled={pending || code.length !== 6}
            >
              {pending ? ta('pleaseWait') : t('deleteAccountConfirmSubmit')}
            </button>
            <button
              className="button button--ghost"
              type="button"
              disabled={pending}
              onClick={() => void sendCode()}
            >
              {t('deleteAccountResendCode')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
