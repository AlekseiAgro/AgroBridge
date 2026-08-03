'use client';

import {
  BUYER_TYPES,
  REGISTERABLE_ROLES,
  SELLER_TYPES,
  type BuyerType,
  type RegisterableRole,
  type SellerType,
} from '@agrobridge/shared';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Mode = 'login' | 'register';

type Props = {
  mode: Mode;
};

export function AuthForm({ mode }: Props) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [role, setRole] = useState<RegisterableRole>('farmer');
  const [sellerType, setSellerType] = useState<SellerType>('privateFarmer');
  const [buyerType, setBuyerType] = useState<BuyerType>('individual');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
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
            ...(role === 'farmer' ? { sellerType } : {}),
            ...(role === 'buyer' ? { buyerType } : {}),
            locale,
          };

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? t('genericError'));
        return;
      }

      router.replace('/account');
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

          {role === 'farmer' ? (
            <fieldset className="role-fieldset">
              <legend>{t('sellerType')}</legend>
              <p className="product-list__meta">{t('sellerTypeHint')}</p>
              {SELLER_TYPES.map((value) => (
                <label key={value} className="role-option">
                  <input
                    type="radio"
                    name="sellerType"
                    value={value}
                    checked={sellerType === value}
                    onChange={() => setSellerType(value)}
                    required
                  />
                  <span>{t(`sellerTypes.${value}`)}</span>
                </label>
              ))}
            </fieldset>
          ) : null}

          {role === 'buyer' ? (
            <fieldset className="role-fieldset">
              <legend>{t('buyerType')}</legend>
              <p className="product-list__meta">{t('buyerTypeHint')}</p>
              {BUYER_TYPES.map((value) => (
                <label key={value} className="role-option">
                  <input
                    type="radio"
                    name="buyerType"
                    value={value}
                    checked={buyerType === value}
                    onChange={() => setBuyerType(value)}
                    required
                  />
                  <span>{t(`buyerTypes.${value}`)}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
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

      {error ? <p className="form-error">{error}</p> : null}

      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t('pleaseWait') : mode === 'login' ? t('loginSubmit') : t('registerSubmit')}
      </button>
    </form>
  );
}
