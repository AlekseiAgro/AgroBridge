import type { RfqSummary } from '@agrobridge/shared';

const OPEN_STATUSES = new Set(['pending', 'offered', 'accepted']);

/** Filter RFQ lists for cabinet activity-summary deep links. */
export function filterRfqsForCabinet(
  items: RfqSummary[],
  query: { status?: string; needsRating?: string },
): RfqSummary[] {
  let filtered = items;

  if (query.needsRating === '1') {
    filtered = filtered.filter((item) => item.canRate);
  }

  if (query.status === 'completed') {
    filtered = filtered.filter((item) => item.status === 'completed');
  } else if (query.status === 'open') {
    filtered = filtered.filter((item) => OPEN_STATUSES.has(item.status));
  }

  return filtered;
}
