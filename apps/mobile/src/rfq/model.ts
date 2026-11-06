import type { MessageKey } from '../i18n/en';

export const RFQ_STATUSES = [
  'pending',
  'offered',
  'accepted',
  'completed',
  'declined',
  'cancelled',
] as const;

export type RfqStatus = (typeof RFQ_STATUSES)[number];

export type RfqParty = {
  id: string;
  displayName: string | null;
  email: string;
};

export type RfqOffer = {
  id: string;
  priceAmount: string;
  currency: string;
  quantity: string | null;
  unit: string | null;
  message: string | null;
  validUntil: string | null;
};

export type MobileRfq = {
  id: string;
  status: RfqStatus;
  quantity: string;
  unit: string | null;
  message: string | null;
  product: { id: string; title: string };
  farm: { id: string; name: string; region: string | null; ownerId: string } | null;
  buyer: RfqParty;
  seller: RfqParty;
  offer: RfqOffer | null;
};

const STATUSES = new Set<string>(RFQ_STATUSES);

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function party(value: unknown): RfqParty | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = text(row.id);
  if (!id) {
    return null;
  }
  return {
    id,
    displayName: text(row.displayName),
    email: text(row.email) ?? '',
  };
}

function offer(value: unknown): RfqOffer | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = text(row.id);
  const priceAmount =
    typeof row.priceAmount === 'number' && Number.isFinite(row.priceAmount)
      ? String(row.priceAmount)
      : text(row.priceAmount);
  const currency = text(row.currency);
  if (!id || !priceAmount || !currency) {
    return null;
  }
  return {
    id,
    priceAmount,
    currency,
    quantity: text(row.quantity),
    unit: text(row.unit),
    message: text(row.message),
    validUntil: text(row.validUntil),
  };
}

export function parseRfq(value: unknown): MobileRfq | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = text(row.id);
  const status = text(row.status);
  const quantity = text(row.quantity);
  const product =
    row.product && typeof row.product === 'object' ? (row.product as Record<string, unknown>) : null;
  const productId = product ? text(product.id) : null;
  const productTitle = product ? text(product.title) : null;
  const buyer = party(row.buyer);
  const seller = party(row.seller);
  if (!id || !status || !STATUSES.has(status) || !quantity || !productId || !productTitle || !buyer || !seller) {
    return null;
  }
  const farmRow = row.farm && typeof row.farm === 'object' ? (row.farm as Record<string, unknown>) : null;
  const farmId = farmRow ? text(farmRow.id) : null;
  const farmName = farmRow ? text(farmRow.name) : null;
  const farm =
    farmRow && farmId && farmName
      ? {
          id: farmId,
          name: farmName,
          region: text(farmRow.region),
          ownerId: text(farmRow.ownerId) ?? '',
        }
      : null;
  return {
    id,
    status: status as RfqStatus,
    quantity,
    unit: text(row.unit),
    message: text(row.message),
    product: { id: productId, title: productTitle },
    farm,
    buyer,
    seller,
    offer: row.offer == null ? null : offer(row.offer),
  };
}

export function parseRfqList(value: unknown): MobileRfq[] {
  if (!Array.isArray(value)) {
    throw new Error('RFQ list was not returned.');
  }
  return value.flatMap((item) => {
    const parsed = parseRfq(item);
    return parsed ? [parsed] : [];
  });
}

export function rfqIdFromCreate(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return text((value as { id?: unknown }).id);
}

export function rfqStatusMessageKey(status: string): MessageKey | null {
  switch (status) {
    case 'pending':
      return 'rfq.status.pending';
    case 'offered':
      return 'rfq.status.offered';
    case 'accepted':
      return 'rfq.status.accepted';
    case 'completed':
      return 'rfq.status.completed';
    case 'declined':
      return 'rfq.status.declined';
    case 'cancelled':
      return 'rfq.status.cancelled';
    default:
      return null;
  }
}
