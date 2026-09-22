import type { PurchaseRequestStatus } from '@agrobridge/shared';

export function requestStatusBadgeClass(status: PurchaseRequestStatus): string {
  return `harvest-badge request-status request-status--${status}`;
}
