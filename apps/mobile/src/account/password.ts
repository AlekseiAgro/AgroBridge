export type PasswordChangeIssue = 'short' | 'mismatch' | 'same';

export function passwordChangeIssue(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): PasswordChangeIssue | null {
  if (
    currentPassword.length < 8 ||
    currentPassword.length > 128 ||
    newPassword.length < 8 ||
    newPassword.length > 128
  ) {
    return 'short';
  }
  if (newPassword !== confirmPassword) return 'mismatch';
  if (currentPassword === newPassword) return 'same';
  return null;
}

export function changePasswordBody(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): { currentPassword: string; newPassword: string } | null {
  if (passwordChangeIssue(currentPassword, newPassword, confirmPassword)) return null;
  return { currentPassword, newPassword };
}
