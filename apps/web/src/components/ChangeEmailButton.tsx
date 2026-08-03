'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

type Step = 'idle' | 'codeSent';

export function ChangeEmailButton({ email }: { email: string }) {
  const t = useTranslations('cabinet');
  const ta = useTranslations('auth');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
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
        throw new Error(t('changeEmailError'));
      }
    }
    if (!response.ok) {
      throw new Error(data?.message ?? t('changeEmailError'));
    }
    return (data ?? {}) as T;
  }

  async function sendCode() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await postJson<{ destination: string; newEmail: string }>(
        '/api/cabinet/me/email/request',
        { password, newEmail },
      );
      setStep('codeSent');
      setNewEmail(result.newEmail || newEmail);
      setMessage(
        t('changeEmailCodeSent', {
          email: result.destination || email,
          newEmail: result.newEmail || newEmail,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('changeEmailError'));
    } finally {
      setPending(false);
    }
  }

  async function onRequestCode(event: FormEvent) {
    event.preventDefault();
    await sendCode();
  }

  async function onConfirm(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await postJson('/api/cabinet/me/email/confirm', { password, code });
      router.replace('/verify-email');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('changeEmailError'));
      setPending(false);
    }
  }

  function reset() {
    setOpen(false);
    setStep('idle');
    setPassword('');
    setNewEmail('');
    setCode('');
    setError(null);
    setMessage(null);
  }

  if (!open) {
    return (
      <div className="profile-edit-row">
        <p className="user-card__meta">
          <span className="profile-edit-row__label">{t('emailLabel')}: </span>
          {email}
        </p>
        <button
          type="button"
          className="button button--ghost profile-edit-row__button"
          onClick={() => setOpen(true)}
        >
          {t('changeEmail')}
        </button>
      </div>
    );
  }

  return (
    <div className="auth-form profile-edit-form">
      <p className="product-list__meta">{t('changeEmailFlowHint', { email })}</p>

      {step === 'idle' ? (
        <form onSubmit={onRequestCode}>
          <label className="field">
            <span>{t('changeEmailNew')}</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
            />
          </label>
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
              {pending ? ta('pleaseWait') : t('changeEmailSendCode')}
            </button>
            <button className="button button--ghost" type="button" disabled={pending} onClick={reset}>
              {t('changeEmailCancel')}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={onConfirm}>
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
            <span>{t('changeEmailCode')}</span>
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
              className="button button--primary"
              type="submit"
              disabled={pending || code.length !== 6}
            >
              {pending ? ta('pleaseWait') : t('changeEmailConfirmSubmit')}
            </button>
            <button
              className="button button--ghost"
              type="button"
              disabled={pending}
              onClick={() => void sendCode()}
            >
              {t('changeEmailResendCode')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
