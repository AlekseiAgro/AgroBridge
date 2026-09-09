'use client';

import type { FarmDocument, ProducerVerificationStatus, SellerType } from '@agrobridge/shared';
import {
  DEFAULT_PHONE_COUNTRY,
  normalizeInternationalPhone,
  parseStoredPhone,
  SELLER_TYPES,
  type CountryCode,
} from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useMemo, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { PhoneNumberField } from '@/components/PhoneNumberField';
import { VerifiedBadge } from '@/components/VerifiedBadge';

type Props = {
  initial: ProducerVerificationStatus;
};

async function postJson<T>(url: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data: (T & { message?: string }) | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as T & { message?: string };
    } catch {
      throw new Error(
        response.ok
          ? 'Unexpected server response'
          : `Request failed (${response.status}). Please try again.`,
      );
    }
  }
  if (!response.ok) {
    throw new Error(data?.message ?? 'Request failed');
  }
  return (data ?? {}) as T;
}

function mapVerificationError(
  err: unknown,
  t: ReturnType<typeof useTranslations<'farm.verification'>>,
): string {
  const message = err instanceof Error ? err.message : '';
  if (!message) {
    return t('genericError');
  }
  if (message === t('phone.invalid')) {
    return message;
  }
  if (/valid phone number/i.test(message)) {
    return t('phone.invalid');
  }
  if (/already verified/i.test(message)) {
    return t('phone.alreadyVerified');
  }
  if (/could not send the sms/i.test(message)) {
    return t('phone.unavailable');
  }
  return message;
}

export function ProducerVerificationPanel({ initial }: Props) {
  const t = useTranslations('farm.verification');
  const tAuth = useTranslations('auth');
  const tFarm = useTranslations('farm');
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const initialPhone = useMemo(() => parseStoredPhone(initial.phone), [initial.phone]);
  const [emailCode, setEmailCode] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(
    initialPhone?.country ?? DEFAULT_PHONE_COUNTRY,
  );
  const [phoneNational, setPhoneNational] = useState(initialPhone?.nationalNumber ?? '');
  const [smsCode, setSmsCode] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState(
    initial.companyRegistrationNumber ?? '',
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const privateFileRef = useRef<HTMLInputElement>(null);
  const companyFileRef = useRef<HTMLInputElement>(null);

  const sellerTypeLocked = status.sellerTypeLocked;

  function applyStatus(next: ProducerVerificationStatus) {
    setStatus(next);
    router.refresh();
  }

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setError(mapVerificationError(err, t));
    } finally {
      setPending(false);
    }
  }

  async function sendEmailCode() {
    await run(async () => {
      const result = await postJson<{ destination: string }>('/api/verification/email/send-code');
      setMessage(t('email.sent', { destination: result.destination }));
    });
  }

  async function confirmEmail(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const next = await postJson<ProducerVerificationStatus>('/api/verification/email/confirm', {
        code: emailCode,
      });
      setEmailCode('');
      applyStatus(next);
      setMessage(t('email.confirmed'));
    });
  }

  async function sendSmsCode(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const e164 = normalizeInternationalPhone(phoneNational, phoneCountry);
      if (!e164) {
        throw new Error(t('phone.invalid'));
      }
      const result = await postJson<{ destination: string }>('/api/verification/phone/send-code', {
        phone: e164,
        country: phoneCountry,
      });
      setMessage(t('phone.sent', { destination: result.destination }));
    });
  }

  async function confirmSms(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const next = await postJson<ProducerVerificationStatus>('/api/verification/phone/confirm', {
        code: smsCode,
      });
      setSmsCode('');
      applyStatus(next);
      setMessage(t('phone.confirmed'));
    });
  }

  async function saveSellerType(sellerType: SellerType) {
    if (sellerTypeLocked || pending || status.sellerType === sellerType) {
      return;
    }
    await run(async () => {
      const next = await postJson<ProducerVerificationStatus>('/api/verification/seller-type', {
        sellerType,
      });
      applyStatus(next);
      setMessage(t('sellerType.saved'));
    });
  }

  async function checkCompany(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const next = await postJson<ProducerVerificationStatus>('/api/verification/company/registry', {
        registrationNumber,
      });
      applyStatus(next);
      setMessage(t('company.matched', { name: next.companyRegistryName ?? registrationNumber }));
    });
  }

  async function uploadVerificationDocument(
    file: File | null,
    kind: 'idCard' | 'businessRegistration',
    input: HTMLInputElement | null,
  ) {
    if (!file) return;
    await run(async () => {
      const body = new FormData();
      body.set('title', kind === 'idCard' ? t('private.idTitle') : t('company.docTitle'));
      body.set('kind', kind);
      body.set('file', file);
      const response = await fetch('/api/farms/me/documents', { method: 'POST', body });
      const data = (await response.json()) as FarmDocument & { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? t('genericError'));
      }
      const statusResponse = await fetch('/api/verification/me');
      const next = (await statusResponse.json()) as ProducerVerificationStatus & {
        message?: string;
      };
      if (!statusResponse.ok) {
        throw new Error(next.message ?? t('genericError'));
      }
      applyStatus(next);
      setMessage(kind === 'idCard' ? t('private.uploaded') : t('company.uploaded'));
    });
    if (input) {
      input.value = '';
    }
  }

  async function submitPrivateReview() {
    await run(async () => {
      const next = await postJson<ProducerVerificationStatus>('/api/verification/private/submit');
      applyStatus(next);
      setMessage(t('private.submitted'));
    });
  }

  const stepLabel = (step: 'done' | 'todo' | 'pending_review' | 'rejected') =>
    t(`stepStatus.${step}`);

  const identityTitle =
    status.path === 'company'
      ? t('company.title')
      : status.path === 'privateFarmer'
        ? t('private.title')
        : t('sellerType.identityTitle');

  return (
    <section className="verification-panel" style={{ marginTop: '2rem' }}>
      <div className="product-images__header">
        <h2 className="section-title">{t('title')}</h2>
        <p className="page__subtitle">{t('subtitle')}</p>
      </div>

      {status.verified ? (
        <div className="verification-panel__done">
          <VerifiedBadge verified />
          <p className="page__subtitle">{t('doneHint')}</p>
        </div>
      ) : (
        <p className="product-list__meta">
          {t('statusLabel')}: {t(`farmStatus.${status.farmVerificationStatus}`)}
        </p>
      )}

      <ol className="verification-steps">
        <li className="verification-steps__item">
          <div className="verification-steps__head">
            <strong>{t('email.title')}</strong>
            <span>{stepLabel(status.steps.email)}</span>
          </div>
          {status.steps.email === 'todo' ? (
            <div className="moderation-actions">
              <button
                type="button"
                className="button button--ghost"
                disabled={pending}
                onClick={sendEmailCode}
              >
                {t('email.send')}
              </button>
              <form className="verification-inline-form" onSubmit={confirmEmail}>
                <label className="field">
                  <span>{t('email.code')}</span>
                  <input
                    value={emailCode}
                    onChange={(event) => setEmailCode(event.target.value)}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    required
                  />
                </label>
                <button className="button" type="submit" disabled={pending}>
                  {t('email.confirm')}
                </button>
              </form>
            </div>
          ) : null}
        </li>

        <li className="verification-steps__item">
          <div className="verification-steps__head">
            <strong>{t('phone.title')}</strong>
            <span>{stepLabel(status.steps.phone)}</span>
          </div>
          {status.steps.phone === 'todo' ? (
            <div className="moderation-actions">
              <form className="verification-phone-form" onSubmit={sendSmsCode}>
                <PhoneNumberField
                  country={phoneCountry}
                  national={phoneNational}
                  disabled={pending}
                  onChange={({ country, national }) => {
                    setPhoneCountry(country);
                    setPhoneNational(national);
                  }}
                />
                <button className="button button--ghost" type="submit" disabled={pending}>
                  {t('phone.send')}
                </button>
              </form>
              <form className="verification-inline-form" onSubmit={confirmSms}>
                <label className="field">
                  <span>{t('phone.code')}</span>
                  <input
                    value={smsCode}
                    onChange={(event) => setSmsCode(event.target.value)}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    required
                  />
                </label>
                <button className="button" type="submit" disabled={pending}>
                  {t('phone.confirm')}
                </button>
              </form>
            </div>
          ) : (
            <p className="product-list__meta">{status.phone}</p>
          )}
        </li>

        <li className="verification-steps__item">
          <div className="verification-steps__head">
            <strong>{identityTitle}</strong>
            <span>{stepLabel(status.steps.identity)}</span>
          </div>

          <fieldset className="verification-seller-type" disabled={pending || sellerTypeLocked}>
            <legend className="verification-seller-type__legend">{t('sellerType.title')}</legend>
            <p className="page__subtitle">{t('sellerType.hint')}</p>
            <div
              className="verification-seller-type__options"
              role="radiogroup"
              aria-label={t('sellerType.title')}
            >
              {SELLER_TYPES.map((value) => {
                const selected = status.sellerType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={
                      selected
                        ? 'verification-seller-type__option is-selected'
                        : 'verification-seller-type__option'
                    }
                    disabled={pending || sellerTypeLocked}
                    onClick={() => void saveSellerType(value)}
                  >
                    {tAuth(`sellerTypes.${value}`)}
                  </button>
                );
              })}
            </div>
            {status.path === 'unknown' ? (
              <p className="page__subtitle">{t('unknownPath')}</p>
            ) : null}
            {sellerTypeLocked ? (
              <p className="product-list__meta">{t('sellerType.locked')}</p>
            ) : null}
          </fieldset>

          {status.path === 'company' && !status.verified ? (
            <div className="verification-identity">
              <p className="page__subtitle">{t('company.documentHint')}</p>
              <label className={pending ? 'verification-upload is-pending' : 'verification-upload'}>
                <span className="button button--primary" aria-hidden="true">
                  {pending ? tFarm('pleaseWait') : t('company.upload')}
                </span>
                <input
                  ref={companyFileRef}
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  disabled={pending}
                  aria-label={t('company.upload')}
                  onChange={(event) =>
                    void uploadVerificationDocument(
                      event.target.files?.[0] ?? null,
                      'businessRegistration',
                      companyFileRef.current,
                    )
                  }
                />
              </label>
              {status.steps.identity !== 'done' ? (
                <form className="verification-inline-form" onSubmit={checkCompany}>
                  <label className="field">
                    <span>{t('company.number')}</span>
                    <input
                      value={registrationNumber}
                      onChange={(event) => setRegistrationNumber(event.target.value)}
                      placeholder="123456789"
                      required
                    />
                  </label>
                  <button className="button button--primary" type="submit" disabled={pending}>
                    {t('company.check')}
                  </button>
                  <p className="page__subtitle">{t('company.hint')}</p>
                </form>
              ) : (
                <p className="product-list__meta">
                  {status.companyRegistryName}
                  {status.companyRegistrationNumber
                    ? ` · ${status.companyRegistrationNumber}`
                    : ''}
                </p>
              )}
            </div>
          ) : null}

          {status.path === 'company' && status.verified && status.companyRegistryName ? (
            <p className="product-list__meta">
              {status.companyRegistryName}
              {status.companyRegistrationNumber
                ? ` · ${status.companyRegistrationNumber}`
                : ''}
            </p>
          ) : null}

          {status.path === 'privateFarmer' && status.steps.identity !== 'done' ? (
            <div className="verification-identity">
              <p className="page__subtitle">{t('private.hint')}</p>
              <label className={pending ? 'verification-upload is-pending' : 'verification-upload'}>
                <span className="button button--primary" aria-hidden="true">
                  {pending ? tFarm('pleaseWait') : t('private.upload')}
                </span>
                <input
                  ref={privateFileRef}
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  disabled={pending}
                  aria-label={t('private.upload')}
                  onChange={(event) =>
                    void uploadVerificationDocument(
                      event.target.files?.[0] ?? null,
                      'idCard',
                      privateFileRef.current,
                    )
                  }
                />
              </label>
              {status.hasPendingIdDocument || status.hasApprovedIdDocument ? (
                <button
                  type="button"
                  className="button button--primary"
                  disabled={pending || status.steps.identity === 'pending_review'}
                  onClick={() => void submitPrivateReview()}
                >
                  {t('private.submit')}
                </button>
              ) : null}
            </div>
          ) : null}
        </li>
      </ol>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
