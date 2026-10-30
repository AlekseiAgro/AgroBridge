import {
  initialPasswordVisible,
  passwordIsHidden,
  togglePasswordVisible,
} from './password-visibility';

describe('password visibility', () => {
  it('hides the password until the eye is tapped, then hides it again', () => {
    const entered = 'password1';
    let visible = initialPasswordVisible();

    expect(visible).toBe(false);
    expect(passwordIsHidden(visible)).toBe(true);

    visible = togglePasswordVisible(visible);
    expect(visible).toBe(true);
    expect(passwordIsHidden(visible)).toBe(false);
    expect(entered).toBe('password1');

    visible = togglePasswordVisible(visible);
    expect(visible).toBe(false);
    expect(passwordIsHidden(visible)).toBe(true);
    expect(entered).toBe('password1');
  });

  it('toggles confirmation independently and leaves the password value unchanged', () => {
    const password = 'password1';
    const confirmation = 'password1';
    let passwordVisible = initialPasswordVisible();
    let confirmVisible = initialPasswordVisible();

    passwordVisible = togglePasswordVisible(passwordVisible);
    expect(passwordVisible).toBe(true);
    expect(confirmVisible).toBe(false);

    confirmVisible = togglePasswordVisible(confirmVisible);
    expect(confirmVisible).toBe(true);
    expect(passwordVisible).toBe(true);

    confirmVisible = togglePasswordVisible(confirmVisible);
    expect(confirmVisible).toBe(false);
    expect(passwordVisible).toBe(true);
    expect(password).toBe('password1');
    expect(confirmation).toBe('password1');
  });
});
