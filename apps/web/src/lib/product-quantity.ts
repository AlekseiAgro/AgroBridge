import type { ProductSummary } from '@agrobridge/shared';

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
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
