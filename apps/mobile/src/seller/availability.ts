import { ApiError } from '../api/errors';
import { draftFailure, type DraftFailure, type DraftGate } from './draft';
import { harvestStatusPatch, type HarvestChoice, type SellerHarvestStatus, type SellerProduct } from './products';

export type HarvestUpdateFailure = DraftFailure | 'notFound' | 'conflict';

export type HarvestUpdateResult =
  | { status: 'ignored' }
  | { status: 'unchanged' }
  | { status: 'updated'; product: SellerProduct }
  | { status: 'failed'; failure: HarvestUpdateFailure };

export function harvestUpdateFailure(error: unknown): HarvestUpdateFailure {
  if (error instanceof ApiError && error.status === 404) return 'notFound';
  if (error instanceof ApiError && error.status === 409) return 'conflict';
  return draftFailure(error);
}

/** Applies one harvest status. Closing the sheet or choosing the current value does not call the API. */
export async function submitHarvestUpdate(input: {
  current: SellerHarvestStatus | null;
  next: HarvestChoice | 'dismiss';
  gate: DraftGate;
  apply: (body: { harvestStatus: SellerHarvestStatus | null }) => Promise<SellerProduct>;
  onPending: (pending: boolean) => void;
}): Promise<HarvestUpdateResult> {
  const body = harvestStatusPatch(input.current, input.next);
  if (!body) return { status: 'unchanged' };
  if (input.gate.pending) return { status: 'ignored' };
  input.gate.pending = true;
  try {
    input.onPending(true);
    return { status: 'updated', product: await input.apply(body) };
  } catch (error) {
    return { status: 'failed', failure: harvestUpdateFailure(error) };
  } finally {
    input.gate.pending = false;
    input.onPending(false);
  }
}
