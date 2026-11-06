import type { ApiClient } from '../api/client';
import type { FarmDocumentKind, FarmSellerType, FarmWriteBody } from './farm';
import { fillFarmDocumentForm, fillFarmPhotoForm } from './farm';
import type { ProductPhotoFile } from './photos';

const JSON = { timeoutMs: 20_000 };

export function fetchMyFarm(api: ApiClient): Promise<unknown> {
  return api.request<unknown>('/farms/me', { ...JSON, method: 'GET' });
}

export function createFarm(api: ApiClient, body: FarmWriteBody): Promise<unknown> {
  return api.request<unknown>('/farms', { ...JSON, method: 'POST', body });
}

export function updateFarm(api: ApiClient, body: FarmWriteBody): Promise<unknown> {
  return api.request<unknown>('/farms/me', { ...JSON, method: 'PATCH', body });
}

export function uploadFarmPhoto(api: ApiClient, file: ProductPhotoFile): Promise<unknown> {
  const form = new FormData();
  fillFarmPhotoForm(form, file);
  return api.request<unknown>('/farms/me/photos', { method: 'POST', formData: form, timeoutMs: 60_000 });
}

export function deleteFarmPhoto(api: ApiClient, photoId: string): Promise<unknown> {
  return api.request<unknown>(`/farms/me/photos/${photoId}`, { ...JSON, method: 'DELETE' });
}

export function setFarmPhotoPrimary(api: ApiClient, photoId: string): Promise<unknown> {
  return api.request<unknown>(`/farms/me/photos/${photoId}/primary`, { ...JSON, method: 'PATCH' });
}

export function uploadFarmDocument(
  api: ApiClient,
  input: { title: string; kind: FarmDocumentKind; file: ProductPhotoFile },
): Promise<unknown> {
  const form = new FormData();
  fillFarmDocumentForm(form, input);
  return api.request<unknown>('/farms/me/documents', { method: 'POST', formData: form, timeoutMs: 60_000 });
}

export function deleteFarmDocument(api: ApiClient, documentId: string): Promise<unknown> {
  return api.request<unknown>(`/farms/me/documents/${documentId}`, { ...JSON, method: 'DELETE' });
}

export function fetchFarmVerification(api: ApiClient): Promise<unknown> {
  return api.request<unknown>('/verification/me', { ...JSON, method: 'GET' });
}

export function saveSellerType(api: ApiClient, sellerType: FarmSellerType): Promise<unknown> {
  return api.request<unknown>('/verification/seller-type', {
    ...JSON,
    method: 'POST',
    body: { sellerType },
  });
}

export function checkCompanyRegistry(api: ApiClient, registrationNumber: string): Promise<unknown> {
  return api.request<unknown>('/verification/company/registry', {
    ...JSON,
    method: 'POST',
    body: { registrationNumber },
  });
}

export function sendFarmPhoneCode(api: ApiClient, phone: string): Promise<unknown> {
  return api.request<unknown>('/verification/phone/send-code', {
    ...JSON,
    method: 'POST',
    body: { phone, country: 'GE' },
  });
}

export function confirmFarmPhoneCode(api: ApiClient, code: string): Promise<unknown> {
  return api.request<unknown>('/verification/phone/confirm', {
    ...JSON,
    method: 'POST',
    body: { code },
  });
}
