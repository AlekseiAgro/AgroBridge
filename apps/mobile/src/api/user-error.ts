import type { MessageKey } from '../i18n/en';
import { ApiError } from './errors';

export type FailureContext = 'credentials' | 'deleteConfirm' | 'general';

export function failureMessageKey(error: unknown, context: FailureContext = 'general'): MessageKey {
  if (!(error instanceof ApiError) || error.kind === 'network' || error.kind === 'timeout') {
    return 'errors.network';
  }
  if (error.status === 429) return 'errors.rateLimit';
  if (error.status === 401) {
    return context === 'credentials' || context === 'deleteConfirm'
      ? 'errors.incorrectPassword'
      : 'errors.unauthorized';
  }
  if (error.status === 403) return 'errors.forbidden';
  if (error.status === 404) return 'errors.notFound';
  if (error.status === 409) return 'errors.conflict';
  if (error.status === 400) {
    return context === 'deleteConfirm' ? 'errors.invalidCode' : 'errors.validation';
  }
  return 'errors.generic';
}
