import type { ProducerVerificationStatus } from '@agrobridge/shared';

/**
 * How the owner dashboard should present voluntary verification. Derived only from
 * the existing `/verification/me` payload — the farm-level status still wins, and
 * confirming an account email is not treated as having started producer verification.
 */
export type VerificationPresentation = 'hidden' | 'prompt' | 'workflow' | 'attention';

export function hasStartedProducerVerification(status: ProducerVerificationStatus): boolean {
  return (
    status.farmVerificationStatus !== 'unverified' ||
    status.sellerType !== null ||
    status.sellerTypeLocked ||
    status.steps.phone === 'done' ||
    status.steps.identity !== 'todo' ||
    status.hasPendingVerificationDocument ||
    status.hasPendingIdDocument ||
    Boolean(status.companyRegistrationNumber)
  );
}

export function verificationPresentation(
  status: ProducerVerificationStatus,
): VerificationPresentation {
  if (status.verified || status.farmVerificationStatus === 'approved') {
    return 'hidden';
  }

  if (status.farmVerificationStatus === 'rejected' || status.steps.identity === 'rejected') {
    return 'attention';
  }

  if (hasStartedProducerVerification(status)) {
    return 'workflow';
  }

  return 'prompt';
}
