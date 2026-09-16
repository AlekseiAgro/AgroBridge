import { readFileSync } from 'fs';
import { join } from 'path';

const webRoot = join(__dirname, '../../../web');
const panel = readFileSync(
  join(webRoot, 'src/components/ProducerVerificationPanel.tsx'),
  'utf8',
);

const LOCALES = ['en', 'ru', 'ka', 'de', 'es', 'fr', 'it'] as const;

type Messages = {
  farm: {
    verification: {
      review: Record<string, string>;
      reason: Record<string, string>;
      private: Record<string, string>;
      company: Record<string, string>;
    };
  };
};

const REASON_CODES = [
  'documentRejected',
  'registryNotConfirmed',
  'contactConfirmationRequired',
  'moderatorRejected',
] as const;

function messages(locale: string): Messages {
  return JSON.parse(readFileSync(join(webRoot, `messages/${locale}.json`), 'utf8')) as Messages;
}

describe('ProducerVerificationPanel submission UI', () => {
  it('has no moderator submit action left in the seller UI', () => {
    expect(panel).not.toContain("t('private.submit')");
    expect(panel).not.toContain('submitPrivateReview');
    expect(panel).not.toContain('/api/verification/private/submit');
  });

  it('reports the received and submitted states instead', () => {
    expect(panel).toContain("t('review.submitted')");
    expect(panel).toContain("t('review.received')");
    expect(panel).toContain("t('review.rejected')");
    expect(panel).toContain("status.farmVerificationStatus === 'pending'");
    expect(panel).toContain('status.hasPendingVerificationDocument');
  });

  it('keeps approved producers out of the review notice', () => {
    expect(panel).toContain("status.verified || status.steps.identity === 'done'");
  });

  it('explains a refusal with a translated reason code and the moderator comment', () => {
    expect(panel).toContain('t(`reason.${status.verificationReasonCode}`)');
    expect(panel).toContain("t('reason.moderatorComment')");
    expect(panel).toContain('status.moderatorComment');
  });

  it('keeps the company registry form tied to the registry check, not the whole step', () => {
    expect(panel).toContain('status.companyRegistryValid !== true');
    expect(panel).toContain("t('company.documentRequired')");
  });

  it('still uploads identity documents through the protected farm documents route', () => {
    expect(panel).toContain("fetch('/api/farms/me/documents', { method: 'POST', body })");
    expect(panel).toContain("body.set('kind', kind)");
    expect(panel).not.toContain('toPublicMediaUrl');
  });
});

describe('verification review copy', () => {
  it.each(LOCALES)('%s translates the review states and drops the submit copy', (locale) => {
    const verification = messages(locale).farm.verification;

    expect(Object.keys(verification.review)).toEqual(['submitted', 'received', 'rejected']);
    for (const value of Object.values(verification.review)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(verification.private.submit).toBeUndefined();
    expect(verification.private.submitted).toBeUndefined();
    expect(verification.private.uploaded).toBeUndefined();
    expect(verification.company.uploaded).toBeUndefined();
  });

  it.each(LOCALES)('%s translates every verification reason code', (locale) => {
    const verification = messages(locale).farm.verification;

    expect(Object.keys(verification.reason).sort()).toEqual(
      ['label', 'moderatorComment', ...REASON_CODES].sort(),
    );
    for (const value of Object.values(verification.reason)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(verification.company.documentRequired.trim().length).toBeGreaterThan(0);
  });

  it('keeps every locale on its own reason wording', () => {
    const rejected = LOCALES.map((locale) => messages(locale).farm.verification.reason.documentRejected);
    expect(new Set(rejected).size).toBe(LOCALES.length);
  });

  it('uses the agreed Russian wording for a submitted document', () => {
    expect(messages('ru').farm.verification.review.submitted).toBe(
      'Документ получен и передан на проверку.',
    );
  });

  it('keeps every locale on its own translation', () => {
    const submitted = LOCALES.map((locale) => messages(locale).farm.verification.review.submitted);
    expect(new Set(submitted).size).toBe(LOCALES.length);
  });
});
