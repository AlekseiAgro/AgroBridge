type Props = {
  id: string;
  name: string;
  label: string;
  autoComplete: 'new-password' | 'current-password';
  shown: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
};

export function PasswordField({
  id,
  name,
  label,
  autoComplete,
  shown,
  onToggle,
  showLabel,
  hideLabel,
}: Props) {
  const visibilityLabel = shown ? hideLabel : showLabel;

  return (
    <div className="field">
      <label htmlFor={id}>
        <span>{label}</span>
      </label>
      <div className="password-field">
        <input
          id={id}
          name={name}
          type={shown ? 'text' : 'password'}
          required
          minLength={8}
          maxLength={128}
          autoComplete={autoComplete}
        />
        <button
          className="password-field__toggle"
          type="button"
          aria-pressed={shown}
          aria-label={visibilityLabel}
          title={visibilityLabel}
          onClick={onToggle}
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12S6.2 6.5 12 6.5 21.5 12 21.5 12 17.8 17.5 12 17.5 2.5 12 2.5 12Z"
      />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3.5 21 20.5M9.2 9.4A3 3 0 0 0 12 15a3 3 0 0 0 2.6-1.5M6.1 6.7C4.2 8.1 2.5 12 2.5 12S6.2 17.5 12 17.5c1.4 0 2.7-.4 3.8-.9M10.2 6.7A10 10 0 0 1 12 6.5C17.8 6.5 21.5 12 21.5 12a17 17 0 0 1-2.2 2.8"
      />
    </svg>
  );
}
