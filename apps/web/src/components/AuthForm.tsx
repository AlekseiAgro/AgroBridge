'use client';

import {
  CURRENT_LEGAL_VERSION,
  REGISTERABLE_ROLES,
  type LegalLocale,
  type PublicUser,
  type RegisterableRole,
} from '@agrobridge/shared';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { safeNextPath } from '@/lib/safe-next-path';

type Mode = 'login' | 'register';

type Props = {
  mode: Mode;
  nextPath?: string;
  termsVersion?: string;
  termsLocale?: LegalLocale;
};

export function AuthForm({ mode, nextPath, termsVersion, termsLocale }: Props) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [role, setRole] = useState<RegisterableRole>(
    nextPath?.includes('/requests/new') ? 'buyer' : 'farmer',
  );
  const redirectTo = safeNextPath(nextPath, '/account');
  const acceptedTermsVersion = termsVersion ?? CURRENT_LEGAL_VERSION;
  const acceptedTermsLocale = termsLocale ?? 'en';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    if (mode === 'register' && form.get('acceptTerms') !== 'true') {
      setError(t('termsRequired'));
      setPending(false);
      return;
    }
    const payload =
      mode === 'login'
        ? {
            email: String(form.get('email') ?? ''),
            password: String(form.get('password') ?? ''),
          }
        : {
            email: String(form.get('email') ?? ''),
            password: String(form.get('password') ?? ''),
            displayName: String(form.get('displayName') ?? ''),
            role,
            locale,
            acceptTerms: form.get('acceptTerms') === 'true',
            acceptedTermsVersion,
            acceptedTermsLocale,
          };

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { message?: string; user?: PublicUser };

      if (!response.ok) {
        setError(data.message ?? t('genericError'));
        return;
      }

      const destination =
        data.user && !data.user.emailVerified
          ? `/verify-email?next=${encodeURIComponent(redirectTo)}`
          : redirectTo;

      router.replace(destination);
      router.refresh();
    } catch {
      setError(t('genericError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      {mode === 'register' ? (
        <>
          <label className="field">
            <span>{t('displayName')}</span>
            <input name="displayName" type="text" autoComplete="name" maxLength={120} />
          </label>

          <fieldset className="role-fieldset">
            <legend>{t('role')}</legend>
            <p className="product-list__meta">{t('dualCapabilityHint')}</p>
            {REGISTERABLE_ROLES.map((value) => (
              <label key={value} className="role-option">
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                />
                <span>{t(`roles.${value}`)}</span>
              </label>
            ))}
          </fieldset>
        </>
      ) : null}

      <label className="field">
        <span>{t('email')}</span>
        <input name="email" type="email" required autoComplete="email" />
      </label>

      <label className="field">
        <span>{t('password')}</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
      </label>

      {mode === 'login' ? (
        <p className="auth-form__forgot">
          <Link href="/forgot-password">{t('forgotPassword')}</Link>
        </p>
      ) : (
        <div className="auth-legal-accept">
          <label className="auth-legal-accept__check">
            <input name="acceptTerms" type="checkbox" value="true" required />
            <span>
              {t.rich('acceptTerms', {
                terms: (chunks) => (
                  <Link href="/terms" locale={acceptedTermsLocale}>
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </label>
          <p className="auth-legal-accept__privacy">
            {t.rich('privacyNotice', {
              privacy: (chunks) => (
                <Link href="/privacy" locale={acceptedTermsLocale}>
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <input type="hidden" name="acceptedTermsVersion" value={acceptedTermsVersion} />
          <input type="hidden" name="acceptedTermsLocale" value={acceptedTermsLocale} />
        </div>
      )}

      {error ? <p className="form-error">{error}</p> : null}

      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t('pleaseWait') : mode === 'login' ? t('loginSubmit') : t('registerSubmit')}
      </button>
    </form>
  );
}
