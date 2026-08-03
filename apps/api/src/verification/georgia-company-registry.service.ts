import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type CompanyRegistryResult = {
  valid: boolean;
  registrationNumber: string;
  legalName: string | null;
  source: 'stub';
  message: string;
};

/**
 * Stub for Georgian public company registry (NAPR / identification code) lookup.
 * Stage 1: validate 9-digit identification codes and return a mock legal name.
 * Replace with a real registry client when KYC/registry integration is ready.
 */
@Injectable()
export class GeorgiaCompanyRegistryService {
  private readonly logger = new Logger(GeorgiaCompanyRegistryService.name);

  constructor(private readonly config: ConfigService) {}

  async lookup(registrationNumber: string): Promise<CompanyRegistryResult> {
    const normalized = registrationNumber.replace(/\s+/g, '').trim();
    const forceFail =
      (this.config.get<string>('GEORGIA_REGISTRY_MODE') ?? 'stub').toLowerCase() ===
      'fail';

    if (forceFail) {
      return {
        valid: false,
        registrationNumber: normalized,
        legalName: null,
        source: 'stub',
        message: 'Registry stub forced failure',
      };
    }

    // Georgian company identification codes are typically 9 digits.
    const valid = /^\d{9}$/.test(normalized);
    if (!valid) {
      return {
        valid: false,
        registrationNumber: normalized,
        legalName: null,
        source: 'stub',
        message: 'Identification code must be exactly 9 digits',
      };
    }

    const legalName = `Registry stub company ${normalized}`;
    this.logger.log(`Stub registry hit for ${normalized} → ${legalName}`);
    return {
      valid: true,
      registrationNumber: normalized,
      legalName,
      source: 'stub',
      message: 'Matched stub Georgian company registry',
    };
  }
}
