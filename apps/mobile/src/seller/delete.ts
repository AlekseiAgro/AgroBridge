import { ApiError } from '../api/errors';
import { draftFailure, type DraftFailure, type DraftGate } from './draft';

export type DeleteFailure = DraftFailure | 'notFound' | 'conflict';

export type DeleteSource = 'list' | 'editor';

export type DeleteChoice = 'cancel' | 'confirm';

export type DeletePrompt = {
  productTitle: string;
  namesProduct: true;
  irreversible: true;
  confirmStyle: 'destructive';
  cancelStyle: 'cancel';
};

export type DeleteSubmitResult =
  | { status: 'ignored' }
  | { status: 'cancelled' }
  | { status: 'deleted'; productId: string }
  | { status: 'failed'; failure: DeleteFailure };

/** The owner may delete a product in any moderation state. */
export function canDeleteSellerProduct(product: { id: string }): boolean {
  return product.id.trim().length > 0;
}

/** Cancel stays the non-destructive choice. Confirm names the product and is irreversible. */
export function deletePrompt(product: { title: string }): DeletePrompt {
  return {
    productTitle: product.title.trim(),
    namesProduct: true,
    irreversible: true,
    confirmStyle: 'destructive',
    cancelStyle: 'cancel',
  };
}

export function destinationAfterDelete(source: DeleteSource): 'MyProducts' | null {
  return source === 'editor' ? 'MyProducts' : null;
}

/** Drops the deleted row and keeps the order of the products that remain. */
export function productsAfterDelete<T extends { id: string }>(products: T[], productId: string): T[] {
  return products.filter((product) => product.id !== productId);
}

export function deleteFailure(error: unknown): DeleteFailure {
  if (error instanceof ApiError && error.status === 404) {
    return 'notFound';
  }
  if (error instanceof ApiError && error.status === 409) {
    return 'conflict';
  }
  return draftFailure(error);
}

let deletedProductId: string | null = null;

export function markProductDeleted(productId: string): void {
  deletedProductId = productId;
}

/** My Products reads this once when it is shown again after a delete from the editor. */
export function takeDeletedProductId(): string | null {
  const productId = deletedProductId;
  deletedProductId = null;
  return productId;
}

/**
 * Confirms, then DELETE /products/:id.
 * The request uses only the product id. Unsaved form values are not saved first.
 */
export async function beginProductDelete(options: {
  product: { id: string; title: string };
  ask: (prompt: DeletePrompt) => Promise<DeleteChoice>;
  gate: DraftGate;
  remove: (productId: string) => Promise<void>;
  onPending: (pending: boolean) => void;
}): Promise<DeleteSubmitResult> {
  if (options.gate.pending || !canDeleteSellerProduct(options.product)) {
    return { status: 'ignored' };
  }
  options.gate.pending = true;
  try {
    const choice = await options.ask(deletePrompt(options.product));
    if (choice !== 'confirm') {
      return { status: 'cancelled' };
    }
    options.onPending(true);
    await options.remove(options.product.id);
    markProductDeleted(options.product.id);
    return { status: 'deleted', productId: options.product.id };
  } catch (error) {
    return { status: 'failed', failure: deleteFailure(error) };
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}
