import { changePasswordBody, passwordChangeIssue } from './password';

describe('change password', () => {
  it('sends the current and new password when they differ and match the confirmation', () => {
    expect(changePasswordBody('password1', 'newpass12', 'newpass12')).toEqual({
      currentPassword: 'password1',
      newPassword: 'newpass12',
    });
  });

  it('rejects a short password, a mismatch, and the same password', () => {
    expect(passwordChangeIssue('short', 'newpass12', 'newpass12')).toBe('short');
    expect(passwordChangeIssue('password1', 'newpass12', 'otherpass')).toBe('mismatch');
    expect(passwordChangeIssue('password1', 'password1', 'password1')).toBe('same');
    expect(changePasswordBody('password1', 'password1', 'password1')).toBeNull();
  });
});
