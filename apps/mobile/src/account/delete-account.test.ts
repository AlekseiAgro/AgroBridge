import {
  accountDeletionConfirmBody,
  accountDeletionRequestBody,
  canConfirmAccountDeletion,
} from './delete-account';

describe('delete account', () => {
  it('asks for a password before the confirmation code', () => {
    expect(accountDeletionRequestBody('short')).toBeNull();
    expect(accountDeletionRequestBody('long-password')).toEqual({ password: 'long-password' });
  });

  it('confirms only with the same password and a 6-digit code', () => {
    expect(canConfirmAccountDeletion('long-password', '12345')).toBe(false);
    expect(accountDeletionConfirmBody('long-password', '123456')).toEqual({
      password: 'long-password',
      code: '123456',
    });
  });

  it('does not confirm when the password is missing', () => {
    expect(accountDeletionConfirmBody('', '123456')).toBeNull();
  });
});
