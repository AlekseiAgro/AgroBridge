/** Public producer classification. Stored as a stable key, never as translated text. */
export const PRODUCER_TYPES = ['individual', 'family', 'cooperative', 'company', 'other'] as const;

export type ProducerType = (typeof PRODUCER_TYPES)[number];

export function isProducerType(value: string | null | undefined): value is ProducerType {
  return Boolean(value && (PRODUCER_TYPES as readonly string[]).includes(value));
}

/**
 * Maps an old free-text ownership value onto a producer type.
 * `llc` and any other unrecognized text stay unmapped.
 */
export function producerTypeFromLegacyOwnership(
  value: string | null | undefined,
): ProducerType | null {
  const normalized = (value ?? '').normalize('NFC').trim().toLowerCase();
  if (normalized === 'family') {
    return 'family';
  }
  if (normalized === 'cooperative') {
    return 'cooperative';
  }
  if (normalized === 'private farm' || normalized === 'частное хозяйство') {
    return 'individual';
  }
  return null;
}
