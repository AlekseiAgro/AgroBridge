'use client';

import type { FarmDocument, ProducerVerificationStatus } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
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
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(data.message ?? 'Request failed');
  }
  return data;
}

export function ProducerVerificationPanel({ initial }: Props) {
  const t = useTranslations('farm.verification');
  const tFarm = useTranslations('farm');
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [emailCode, setEmailCode] = useState('');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [smsCode, setSmsCode] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState(
    initial.companyRegistrationNumber ?? '',
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : t('genericError'));
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
      const result = await postJson<{ destination: string }>('/api/verification/phone/send-code', {
        phone,
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

  async function uploadIdCard(file: File | null) {
    if (!file) return;
    await run(async () => {
      const body = new FormData();
      body.set('title', t('private.idTitle'));
      body.set('kind', 'idCard');
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
      setMessage(t('private.uploaded'));
    });
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
              <form className="verification-inline-form" onSubmit={sendSmsCode}>
                <label className="field">
                  <span>{t('phone.number')}</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+9955…"
                    required
                  />
                </label>
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
            <strong>
              {status.path === 'company' ? t('company.title') : t('private.title')}
            </strong>
            <span>{stepLabel(status.steps.identity)}</span>
          </div>

          {status.path === 'company' && status.steps.identity !== 'done' ? (
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
              <button className="button" type="submit" disabled={pending}>
                {t('company.check')}
              </button>
              <p className="page__subtitle">{t('company.hint')}</p>
            </form>
          ) : null}

          {status.path === 'company' && status.steps.identity === 'done' ? (
            <p className="product-list__meta">
              {status.companyRegistryName}
              {status.companyRegistrationNumber
                ? ` · ${status.companyRegistrationNumber}`
                : ''}
            </p>
          ) : null}

          {status.path === 'privateFarmer' && status.steps.identity !== 'done' ? (
            <div className="moderation-actions">
              <p className="page__subtitle">{t('private.hint')}</p>
              <label className="product-images__upload">
                <span>{pending ? tFarm('pleaseWait') : t('private.upload')}</span>
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  disabled={pending}
                  onChange={(event) => uploadIdCard(event.target.files?.[0] ?? null)}
                />
              </label>
              {status.hasPendingIdDocument || status.hasApprovedIdDocument ? (
                <button
                  type="button"
                  className="button"
                  disabled={pending || status.steps.identity === 'pending_review'}
                  onClick={submitPrivateReview}
                >
                  {t('private.submit')}
                </button>
              ) : null}
            </div>
          ) : null}

          {status.path === 'unknown' ? (
            <p className="form-error">{t('unknownPath')}</p>
          ) : null}
        </li>
      </ol>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
