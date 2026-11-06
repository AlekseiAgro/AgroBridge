export type MineQuote = {
  id: string;
  status: string;
  priceAmount: string;
  currency: string;
  quantity: string | null;
  unit: string | null;
  createdAt: string | null;
  canOpenRequest: boolean;
  requestTitle: string;
  requestId: string;
  requestStatus: string;
  requestQuantity: string;
  requestUnit: string | null;
  buyerName: string | null;
};

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function parseMineQuotes(value: unknown): MineQuote[] {
  if (!Array.isArray(value)) {
    throw new Error('Quotes response was not a list.');
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const request = row.request && typeof row.request === 'object' ? (row.request as Record<string, unknown>) : null;
    const buyer = request?.buyer && typeof request.buyer === 'object' ? (request.buyer as Record<string, unknown>) : null;
    const id = text(row.id);
    const requestId = request ? text(request.id) : null;
    const requestTitle = request ? text(request.title) : null;
    const priceAmount = text(row.priceAmount);
    const currency = text(row.currency);
    if (!id || !requestId || !requestTitle || !priceAmount || !currency) return [];
    return [
      {
        id,
        status: text(row.status) ?? 'pending',
        priceAmount,
        currency,
        quantity: text(row.quantity),
        unit: text(row.unit),
        createdAt: text(row.createdAt),
        canOpenRequest: row.canOpenRequest === true,
        requestTitle,
        requestId,
        requestStatus: request ? (text(request.status) ?? 'open') : 'open',
        requestQuantity: request ? (text(request.quantity) ?? '') : '',
        requestUnit: request ? text(request.unit) : null,
        buyerName: buyer ? text(buyer.displayName) : null,
      },
    ];
  });
}

export function conversationIdFromCreate(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' && id.trim() ? id : null;
}
