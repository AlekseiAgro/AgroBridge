/** Password fields start hidden. Each field keeps its own flag. */
export function initialPasswordVisible(): boolean {
  return false;
}

export function togglePasswordVisible(visible: boolean): boolean {
  return !visible;
}

/** `secureTextEntry` is on while the password is hidden. */
export function passwordIsHidden(visible: boolean): boolean {
  return !visible;
}
