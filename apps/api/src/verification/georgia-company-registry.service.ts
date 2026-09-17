import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type CompanyRegistryResult = {
  /** The lookup was accepted, so the seller may keep the identification code on file. */
  valid: boolean;
  /**
   * What `Farm.companyRegistryValid` becomes. `true` only when a registry actually
   * confirmed the company, `false` on a refusal, and `null` when no registry answered at
   * all — the state the verification gate must never read as a confirmation.
   */
  confirmed: boolean | null;
  registrationNumber: string;
  legalName: string | null;
  source: CompanyRegistryMode;
  message: string;
};

/**
 * How a lookup is answered while there is no real registry client.
 *
 * - `stub` invents a legal name and reports a confirmation, so development and tests can
 *   drive the whole company path.
 * - `unverified` only checks that the code is well formed and says so plainly. It never
 *   invents a name and never reports a confirmation, because either one reads exactly like
 *   a registry that answered.
 * - `fail` rejects every lookup, for exercising the failure path.
 */
export const COMPANY_REGISTRY_MODES = ['stub', 'unverified', 'fail'] as const;
export type CompanyRegistryMode = (typeof COMPANY_REGISTRY_MODES)[number];

/** Georgian company identification codes are nine digits. */
const IDENTIFICATION_CODE_RE = /^\d{9}$/;

const FORMAT_ERROR_MESSAGE = 'Identification code must be exactly 9 digits';

/**
 * Wording for a production lookup. It is deliberately explicit that nothing was confirmed
 * against a registry, so neither the seller nor a moderator can read it as a check that
 * passed.
 */
const UNVERIFIED_MESSAGE =
  'Company registry is not connected: the identification code was recorded but not verified. ' +
  'A moderator will confirm your company from the registration document.';

/**
 * Stub for Georgian public company registry (NAPR / identification code) lookup.
 * Replace with a real registry client when the registry integration is ready.
 *
 * A real lookup does not exist yet, so the danger is not that the check is missing — it is
 * that its output looks like a check that happened. In production the service therefore
 * defaults to `unverified`: the code is accepted so a company can still apply, but no legal
 * name is invented and `confirmed` stays null, so nine well-formed digits can never satisfy
 * the registry gate on their own. A moderator then decides the farm (see
 * VerificationService.applyModeratorDecision).
 */
@Injectable()
export class GeorgiaCompanyRegistryService {
  private readonly logger = new Logger(GeorgiaCompanyRegistryService.name);
  private readonly mode: CompanyRegistryMode;

  constructor(private readonly config: ConfigService) {
    this.mode = this.resolveMode();
    this.logger.log(`Using company registry mode: ${this.mode}`);
    if (this.mode === 'stub' && this.isProduction()) {
      this.logger.warn(
        'GEORGIA_REGISTRY_MODE=stub in production: lookups return an invented legal name. ' +
          'Unset it to fall back to the safe "unverified" mode.',
      );
    }
  }

  async lookup(registrationNumber: string): Promise<CompanyRegistryResult> {
    const normalized = registrationNumber.replace(/\s+/g, '').trim();

    if (this.mode === 'fail') {
      return {
        valid: false,
        confirmed: false,
        registrationNumber: normalized,
        legalName: null,
        source: 'fail',
        message: 'Registry stub forced failure',
      };
    }

    if (!IDENTIFICATION_CODE_RE.test(normalized)) {
      return {
        valid: false,
        confirmed: false,
        registrationNumber: normalized,
        legalName: null,
        source: this.mode,
        message: FORMAT_ERROR_MESSAGE,
      };
    }

    if (this.mode === 'unverified') {
      // Accepted but not confirmed. A legal name would be shown to the seller as though a
      // registry had returned it, and `confirmed: true` would let nine digits walk straight
      // through the company verification gate.
      return {
        valid: true,
        confirmed: null,
        registrationNumber: normalized,
        legalName: null,
        source: 'unverified',
        message: UNVERIFIED_MESSAGE,
      };
    }

    const legalName = `Registry stub company ${normalized}`;
    this.logger.log(`Stub registry hit for ${normalized} → ${legalName}`);
    return {
      valid: true,
      confirmed: true,
      registrationNumber: normalized,
      legalName,
      source: 'stub',
      message: 'Matched stub Georgian company registry',
    };
  }

  private resolveMode(): CompanyRegistryMode {
    const raw = this.config.get<string>('GEORGIA_REGISTRY_MODE')?.trim().toLowerCase();
    if (raw && (COMPANY_REGISTRY_MODES as readonly string[]).includes(raw)) {
      return raw as CompanyRegistryMode;
    }
    if (raw) {
      this.logger.warn(
        `Unknown GEORGIA_REGISTRY_MODE "${raw}"; falling back to the safe default for this environment.`,
      );
    }
    // Production never invents data by default; development keeps the richer stub.
    return this.isProduction() ? 'unverified' : 'stub';
  }

  private isProduction(): boolean {
    return (this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV) === 'production';
  }
}
