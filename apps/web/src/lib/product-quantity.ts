import type { ProductSummary } from '@agrobridge/shared';

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

/** Current seller-maintained stock as `800 kg`. Null when stock is unset. */
export function formatCurrentStock(
  product: Pick<ProductSummary, 'currentStock' | 'unit'>,
): string | null {
  const stock = product.currentStock;
  if (stock == null || !Number.isFinite(stock)) {
    return null;
  }
  const unit = product.unit?.trim();
  return unit ? `${formatAmount(stock)} ${unit}` : formatAmount(stock);
}

export function formatProductQuantityRange(
  product: Pick<ProductSummary, 'minQuantity' | 'maxQuantity' | 'unit'>,
  unitLabel?: string | null,
): string | null {
  const min = product.minQuantity;
  const max = product.maxQuantity;
  if (min == null && max == null) {
    return null;
  }

  const unit = unitLabel?.trim() ? ` ${unitLabel}` : product.unit ? ` ${product.unit}` : '';

  if (min != null && max != null) {
    if (min === max) {
      return `${formatAmount(min)}${unit}`;
    }
    return `${formatAmount(min)}–${formatAmount(max)}${unit}`;
  }
  if (min != null) {
    return `≥ ${formatAmount(min)}${unit}`;
  }
  return `≤ ${formatAmount(max!)}${unit}`;
}
