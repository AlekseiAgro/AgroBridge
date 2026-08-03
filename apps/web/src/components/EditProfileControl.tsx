'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

type EmailStep = 'idle' | 'codeSent';

type Props = {
  initialDisplayName: string | null;
  email: string;
};

export function EditProfileControl({ initialDisplayName, email }: Props) {
  const t = useTranslations('cabinet');
  const ta = useTranslations('auth');
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '');
  const [namePending, setNamePending] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<EmailStep>('idle');
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailPending, setEmailPending] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const shownName = displayName.trim() || t('noDisplayName');

  async function onSaveName(event: FormEvent) {
    event.preventDefault();
    setNamePending(true);
    setNameError(null);
    setNameSaved(false);
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
      setNameSaved(true);
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

  function closePanel() {
    setOpen(false);
    setDisplayName(initialDisplayName ?? '');
    setNameError(null);
    setNameSaved(false);
    setEmailOpen(false);
    setEmailStep('idle');
    setPassword('');
    setNewEmail('');
    setCode('');
    setEmailError(null);
    setEmailMessage(null);
  }

  return (
    <div className="edit-profile">
      <div className="edit-profile__name-row">
        <h2 className="user-card__name">{shownName}</h2>
        <button
          type="button"
          className="edit-profile__pencil"
          title={t('editProfile')}
          aria-label={t('editProfile')}
          aria-expanded={open}
          onClick={() => {
            if (open) {
              closePanel();
            } else {
              setOpen(true);
              setNameSaved(false);
            }
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.99-1.66z"
            />
          </svg>
        </button>
      </div>

      {!open ? <p className="user-card__meta">{email}</p> : null}

      {open ? (
        <div className="edit-profile__panel">
          <form className="profile-edit-form" onSubmit={onSaveName}>
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
            {nameError ? <p className="form-error">{nameError}</p> : null}
            {nameSaved ? <p className="product-list__meta">{t('displayNameSaved')}</p> : null}
            <div className="how-it-works__actions">
              <button className="button button--primary" type="submit" disabled={namePending}>
                {namePending ? ta('pleaseWait') : t('displayNameSave')}
              </button>
            </div>
          </form>

          <div className="edit-profile__email">
            <p className="user-card__meta">
              <span className="profile-edit-row__label">{t('emailLabel')}: </span>
              {email}
            </p>
            {!emailOpen ? (
              <button
                type="button"
                className="button button--ghost profile-edit-row__button"
                onClick={() => setEmailOpen(true)}
              >
                {t('changeEmail')}
              </button>
            ) : (
              <div className="auth-form profile-edit-form">
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
                    <div className="how-it-works__actions">
                      <button className="button button--primary" type="submit" disabled={emailPending}>
                        {emailPending ? ta('pleaseWait') : t('changeEmailSendCode')}
                      </button>
                      <button
                        className="button button--ghost"
                        type="button"
                        disabled={emailPending}
                        onClick={() => {
                          setEmailOpen(false);
                          setEmailStep('idle');
                          setPassword('');
                          setNewEmail('');
                          setEmailError(null);
                          setEmailMessage(null);
                        }}
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
                    <div className="how-it-works__actions">
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
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          <button type="button" className="button button--ghost" onClick={closePanel}>
            {t('displayNameCancel')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
