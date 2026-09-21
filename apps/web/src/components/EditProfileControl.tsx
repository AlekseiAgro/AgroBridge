'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

type EmailStep = 'idle' | 'codeSent';
type Editing = 'none' | 'name' | 'email';

type Props = {
  initialDisplayName: string | null;
  email: string;
};

export function EditProfileControl({ initialDisplayName, email }: Props) {
  const t = useTranslations('cabinet');
  const ta = useTranslations('auth');
  const router = useRouter();

  const [editing, setEditing] = useState<Editing>('none');
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '');
  const [namePending, setNamePending] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [emailStep, setEmailStep] = useState<EmailStep>('idle');
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailPending, setEmailPending] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const shownName = displayName.trim() || t('noDisplayName');

  function closeName() {
    setEditing((current) => (current === 'name' ? 'none' : current));
    setDisplayName(initialDisplayName ?? '');
    setNameError(null);
    setNamePending(false);
  }

  function closeEmail() {
    setEditing((current) => (current === 'email' ? 'none' : current));
    setEmailStep('idle');
    setPassword('');
    setNewEmail('');
    setCode('');
    setEmailError(null);
    setEmailMessage(null);
    setEmailPending(false);
  }

  function startEditing(next: Editing) {
    if (next !== 'name') closeName();
    if (next !== 'email') closeEmail();
    setEditing(next);
  }

  async function onSaveName(event: FormEvent) {
    event.preventDefault();
    setNamePending(true);
    setNameError(null);
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
        setNameError(data.message ?? t('displayNameError'));
        return;
      }
      setDisplayName(data.displayName ?? '');
      setEditing('none');
      router.refresh();
    } catch {
      setNameError(t('displayNameError'));
    } finally {
      setNamePending(false);
    }
  }

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

  async function sendEmailCode() {
    setEmailPending(true);
    setEmailError(null);
    setEmailMessage(null);
    try {
      const result = await postJson<{ destination: string; newEmail: string }>(
        '/api/cabinet/me/email/request',
        { password, newEmail },
      );
      setEmailStep('codeSent');
      setNewEmail(result.newEmail || newEmail);
      setEmailMessage(
        t('changeEmailCodeSent', {
          email: result.destination || email,
          newEmail: result.newEmail || newEmail,
        }),
      );
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : t('changeEmailError'));
    } finally {
      setEmailPending(false);
    }
  }

  async function onConfirmEmail(event: FormEvent) {
    event.preventDefault();
    setEmailPending(true);
    setEmailError(null);
    try {
      await postJson('/api/cabinet/me/email/confirm', { password, code });
      router.replace('/verify-email');
      router.refresh();
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : t('changeEmailError'));
      setEmailPending(false);
    }
  }

  return (
    <>
      <div className={editing === 'name' ? 'settings-row settings-row--editing' : 'settings-row'}>
        <p className="settings-row__label">{t('displayNameLabel')}</p>
        {editing === 'name' ? (
          <form className="profile-edit-form" onSubmit={onSaveName}>
            <label className="field">
              <input
                type="text"
                maxLength={120}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={ta('displayName')}
                autoComplete="name"
                aria-label={t('displayNameLabel')}
              />
            </label>
            {nameError ? <p className="form-error">{nameError}</p> : null}
            <div className="settings-row__actions">
              <button className="button button--primary" type="submit" disabled={namePending}>
                {namePending ? ta('pleaseWait') : t('displayNameSave')}
              </button>
              <button
                className="button button--ghost"
                type="button"
                disabled={namePending}
                onClick={closeName}
              >
                {t('displayNameCancel')}
              </button>
            </div>
          </form>
        ) : (
          <div className="settings-row__body">
            <p className="settings-row__value">{shownName}</p>
            <button
              type="button"
              className="settings-row__action"
              onClick={() => startEditing('name')}
            >
              {t('settingsEdit')}
            </button>
          </div>
        )}
      </div>

      <div className={editing === 'email' ? 'settings-row settings-row--editing' : 'settings-row'}>
        <p className="settings-row__label">{t('emailLabel')}</p>
        {editing === 'email' ? (
          <div className="auth-form profile-edit-form">
            <p className="settings-row__value">{email}</p>
            <p className="product-list__meta">{t('changeEmailFlowHint', { email })}</p>
            {emailStep === 'idle' ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendEmailCode();
                }}
              >
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
                {emailError ? <p className="form-error">{emailError}</p> : null}
                <div className="settings-row__actions">
                  <button className="button button--primary" type="submit" disabled={emailPending}>
                    {emailPending ? ta('pleaseWait') : t('changeEmailSendCode')}
                  </button>
                  <button
                    className="button button--ghost"
                    type="button"
                    disabled={emailPending}
                    onClick={closeEmail}
                  >
                    {t('changeEmailCancel')}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={onConfirmEmail}>
                {emailMessage ? <p className="product-list__meta">{emailMessage}</p> : null}
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
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                  />
                </label>
                {emailError ? <p className="form-error">{emailError}</p> : null}
                <div className="settings-row__actions">
                  <button
                    className="button button--primary"
                    type="submit"
                    disabled={emailPending || code.length !== 6}
                  >
                    {emailPending ? ta('pleaseWait') : t('changeEmailConfirmSubmit')}
                  </button>
                  <button
                    className="button button--ghost"
                    type="button"
                    disabled={emailPending}
                    onClick={() => void sendEmailCode()}
                  >
                    {t('changeEmailResendCode')}
                  </button>
                  <button
                    className="button button--ghost"
                    type="button"
                    disabled={emailPending}
                    onClick={closeEmail}
                  >
                    {t('changeEmailCancel')}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="settings-row__body">
            <p className="settings-row__value">{email}</p>
            <button
              type="button"
              className="settings-row__action"
              onClick={() => startEditing('email')}
            >
              {t('settingsEdit')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
