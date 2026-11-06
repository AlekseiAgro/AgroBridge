import type { ApiClient } from '../api/client';
import { parseRfq, parseRfqList, type MobileRfq } from './model';

export type RfqHttpMethod = 'GET' | 'POST' | 'DELETE';

export type RfqHttpCall = {
  method: RfqHttpMethod;
  path: string;
  body?: unknown;
};

export type RfqCall =
  | { kind: 'get'; rfqId: string }
  | { kind: 'mine' }
  | { kind: 'inbox' }
  | { kind: 'offer'; rfqId: string; body: Record<string, string> }
  | { kind: 'accept' | 'decline' | 'cancel' | 'complete' | 'delete'; rfqId: string }
  | { kind: 'chat'; rfqId: string; locale: string };

function rfqPath(rfqId: string, suffix = ''): string {
  return `/rfqs/${encodeURIComponent(rfqId)}${suffix}`;
}

/** Describes an existing RFQ endpoint. Chat always sends `rfqId`, never a purchase-request id. */
export function rfqRequest(call: RfqCall): RfqHttpCall {
  switch (call.kind) {
    case 'get':
      return { method: 'GET', path: rfqPath(call.rfqId) };
    case 'mine':
      return { method: 'GET', path: '/rfqs/mine' };
    case 'inbox':
      return { method: 'GET', path: '/rfqs/inbox' };
    case 'offer':
      return { method: 'POST', path: rfqPath(call.rfqId, '/offer'), body: call.body };
    case 'accept':
    case 'decline':
    case 'cancel':
    case 'complete':
      return { method: 'POST', path: rfqPath(call.rfqId, `/${call.kind}`) };
    case 'delete':
      return { method: 'DELETE', path: rfqPath(call.rfqId) };
    case 'chat':
      return {
        method: 'POST',
        path: '/conversations',
        body: { rfqId: call.rfqId, locale: call.locale },
      };
  }
}

async function send(api: ApiClient, call: RfqCall): Promise<unknown> {
  const request = rfqRequest(call);
  return api.request(request.path, {
    method: request.method,
    body: request.body,
  });
}

export async function getRfq(api: ApiClient, rfqId: string): Promise<MobileRfq> {
  const parsed = parseRfq(await send(api, { kind: 'get', rfqId }));
  if (!parsed) {
    throw new Error('RFQ response was incomplete.');
  }
  return parsed;
}

/** Buyer list: RFQs the current user created. The server decides which rows are returned. */
export async function listMyRfqs(api: ApiClient): Promise<MobileRfq[]> {
  return parseRfqList(await send(api, { kind: 'mine' }));
}

/** Seller inbox: RFQs for products owned by the current user, including cancelled rows. */
export async function listRfqInbox(api: ApiClient): Promise<MobileRfq[]> {
  return parseRfqList(await send(api, { kind: 'inbox' }));
}

export async function postRfqOffer(
  api: ApiClient,
  rfqId: string,
  body: Record<string, string>,
): Promise<void> {
  await send(api, { kind: 'offer', rfqId, body });
}

export async function postRfqAction(
  api: ApiClient,
  rfqId: string,
  action: 'accept' | 'decline' | 'cancel' | 'complete',
): Promise<void> {
  await send(api, { kind: action, rfqId });
}

export async function deleteRfq(api: ApiClient, rfqId: string): Promise<void> {
  await send(api, { kind: 'delete', rfqId });
}

export async function createRfqConversation(
  api: ApiClient,
  rfqId: string,
  locale: string,
): Promise<unknown> {
  return send(api, { kind: 'chat', rfqId, locale });
}
