export function canRequestAccountDeletion(password: string): boolean {
  return password.length >= 8 && password.length <= 128;
}

export function canConfirmAccountDeletion(password: string, code: string): boolean {
  return canRequestAccountDeletion(password) && /^\d{6}$/.test(code.trim());
}

export function accountDeletionRequestBody(password: string): { password: string } | null {
  if (!canRequestAccountDeletion(password)) return null;
  return { password };
}

export function accountDeletionConfirmBody(
  password: string,
  code: string,
): { password: string; code: string } | null {
  if (!canConfirmAccountDeletion(password, code)) return null;
  return { password, code: code.trim() };
}
