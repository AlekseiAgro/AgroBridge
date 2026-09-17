import { readFileSync } from 'fs';
import { join } from 'path';

const webRoot = join(__dirname, '../../../web');
const panel = readFileSync(
  join(webRoot, 'src/components/ProducerVerificationPanel.tsx'),
  'utf8',
);
const farmPage = readFileSync(
  join(webRoot, 'src/app/[locale]/dashboard/farm/page.tsx'),
  'utf8',
);
const loadErrorPanel = readFileSync(
  join(webRoot, 'src/components/VerificationLoadError.tsx'),
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
      email: Record<string, string>;
      loadError: string;
      loadRetry: string;
      loadRetrying: string;
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
    expect(panel).toContain('const registryConfirmed = status.companyRegistryValid === true');
    expect(panel).toContain('{!registryConfirmed ? (');
    expect(panel).toContain("t('company.documentRequired')");
  });

  it('never calls an unanswered registry lookup a match', () => {
    // Production records the identification code without a legal name; the seller must not
    // read that as a registry that confirmed the company.
    expect(panel).toContain("t('company.registryUnavailable')");
    expect(panel).toContain('{registryRecorded ? (');
    // A saved code is not a confirmation, so the confirmed-only branch may not key on it.
    expect(panel).not.toContain('status.companyRegistryValid === true && !status.companyRegistryName');
  });

  it('shows the saved identification code even when no registry confirmed it', () => {
    expect(panel).toContain('Boolean(status.companyRegistrationNumber)');
    expect(panel).toContain('{registryConfirmed || registryRecorded ? (');
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
    expect(verification.company.registryUnavailable.trim().length).toBeGreaterThan(0);
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

  it.each(LOCALES)('%s tells the seller a code was sent without mentioning server logs', (locale) => {
    const sent = messages(locale).farm.verification.email.sent;

    expect(sent).toContain('{destination}');
    expect(sent).not.toMatch(/demo|API console|mail logs|логи|ლოგებ/i);
  });
});

describe('verification status load failure', () => {
  it('shows an error panel instead of removing the verification flow', () => {
    // The panel disappearing reads as "nothing to verify here", not "the API is down".
    expect(farmPage).toContain('verificationUnavailable = true');
    expect(farmPage).toContain('{verificationUnavailable ? <VerificationLoadError /> : null}');
  });

  it('keeps the success and empty states untouched', () => {
    expect(farmPage).toContain(
      '{verification ? <ProducerVerificationPanel initial={verification} /> : null}',
    );
  });

  it('offers a localized message and a retry that refetches', () => {
    expect(loadErrorPanel).toContain("t('loadError')");
    expect(loadErrorPanel).toContain("t('loadRetry')");
    expect(loadErrorPanel).toContain('router.refresh()');
  });

  it.each(LOCALES)('%s translates the failure state', (locale) => {
    const verification = messages(locale).farm.verification;

    for (const value of [
      verification.loadError,
      verification.loadRetry,
      verification.loadRetrying,
    ]) {
      expect(typeof value).toBe('string');
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps every locale on its own failure wording', () => {
    const errors = LOCALES.map((locale) => messages(locale).farm.verification.loadError);
    expect(new Set(errors).size).toBe(LOCALES.length);
  });
});
