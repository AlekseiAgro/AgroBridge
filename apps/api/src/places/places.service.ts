import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PlacesAutocompleteResponse, PlaceSuggestion } from '@agrobridge/shared';
import { PLACE_AUTOCOMPLETE_MIN_CHARS } from '@agrobridge/shared';

type GoogleAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
  error?: { message?: string; status?: string };
};

const COUNTRY_TO_REGION: Record<string, string> = {
  georgia: 'ge',
  ge: 'ge',
  საქართველო: 'ge',
  грузия: 'ge',
};

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  constructor(private readonly config: ConfigService) {}

  async autocomplete(
    query: string,
    options: { language?: string; country?: string } = {},
  ): Promise<PlacesAutocompleteResponse> {
    const apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY')?.trim();
    if (!apiKey) {
      return { enabled: false, suggestions: [] };
    }

    const input = query.trim();
    if (input.length < PLACE_AUTOCOMPLETE_MIN_CHARS) {
      return { enabled: true, suggestions: [] };
    }

    const languageCode = this.normalizeLanguage(options.language);
    const regionCode = this.resolveRegionCode(options.country);

    const body: Record<string, unknown> = {
      input,
      languageCode,
      // Settlements only — no street addresses / premises.
      includedPrimaryTypes: ['locality', 'administrative_area_level_3', 'administrative_area_level_2'],
      includeQueryPredictions: false,
    };

    if (regionCode) {
      body.includedRegionCodes = [regionCode];
      body.regionCode = regionCode.toUpperCase();
    }

    if (regionCode === 'ge') {
      body.locationBias = {
        rectangle: {
          low: { latitude: 41.05, longitude: 39.95 },
          high: { latitude: 43.6, longitude: 46.75 },
        },
      };
    }

    try {
      const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as GoogleAutocompleteResponse;
      if (!response.ok) {
        this.logger.warn(
          `Places autocomplete failed (${response.status}): ${data.error?.message ?? 'unknown error'}`,
        );
        return { enabled: true, suggestions: [] };
      }

      const suggestions: PlaceSuggestion[] = [];
      for (const item of data.suggestions ?? []) {
        const prediction = item.placePrediction;
        if (!prediction?.placeId) continue;

        const mainText =
          prediction.structuredFormat?.mainText?.text?.trim() ||
          prediction.text?.text?.trim() ||
          '';
        if (!mainText) continue;

        const secondaryText = prediction.structuredFormat?.secondaryText?.text?.trim() || null;
        const label = prediction.text?.text?.trim() || mainText;

        suggestions.push({
          placeId: prediction.placeId,
          label,
          mainText,
          secondaryText,
        });
      }

      return { enabled: true, suggestions: suggestions.slice(0, 8) };
    } catch (error) {
      this.logger.warn(
        `Places autocomplete request failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return { enabled: true, suggestions: [] };
    }
  }

  private normalizeLanguage(language?: string): string {
    const value = (language ?? 'en').trim().toLowerCase();
    if (!value) return 'en';
    // next-intl locales: ka, en, ru, de, fr, it, es
    return value.split('-')[0] || 'en';
  }

  private resolveRegionCode(country?: string): string | null {
    const raw = country?.trim().toLowerCase();
    if (!raw) return 'ge';
    return COUNTRY_TO_REGION[raw] ?? null;
  }
}
