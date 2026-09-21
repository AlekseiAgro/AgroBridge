type SettingsSectionIconName = 'profile' | 'security' | 'notifications' | 'legal' | 'danger';

type Props = {
  id: string;
  title: string;
  description?: string;
  icon: SettingsSectionIconName;
  tone?: 'default' | 'danger';
};

function SettingsSectionIcon({ name }: { name: SettingsSectionIconName }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 18,
    height: 18,
    'aria-hidden': true,
    focusable: false,
  } as const;

  if (name === 'profile') {
    return (
      <svg {...common}>
        <path
          d="M12 12a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <path
          d="M5.6 19.2c.8-2.8 3.3-4.4 6.4-4.4s5.6 1.6 6.4 4.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === 'security') {
    return (
      <svg {...common}>
        <rect
          x="6.2"
          y="10.2"
          width="11.6"
          height="8.6"
          rx="1.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <path
          d="M8.4 10.2V8.4a3.6 3.6 0 0 1 7.2 0v1.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === 'notifications') {
    return (
      <svg {...common}>
        <path
          d="M12 3.5c-3.1 0-5.5 2.4-5.5 5.3v2.1c0 .8-.3 1.6-.9 2.2l-.8.8c-.7.7-.2 1.9.8 1.9h13c1 0 1.5-1.2.8-1.9l-.8-.8c-.6-.6-.9-1.4-.9-2.2V8.8c0-2.9-2.4-5.3-5.5-5.3Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M9.6 17.8a2.5 2.5 0 0 0 4.8 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === 'legal') {
    return (
      <svg {...common}>
        <path
          d="M7.2 4.4h7.1L17.8 8v11.6H7.2V4.4Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M14.2 4.4V8h3.6M9.4 12.2h6.2M9.4 15.4h6.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path
        d="M5.4 7.2h13.2M9.2 7.2V5.8c0-.7.6-1.3 1.3-1.3h2.9c.8 0 1.4.6 1.4 1.3v1.4M16.4 7.2l-.7 11.1c0 .7-.6 1.3-1.3 1.3H9.6c-.7 0-1.3-.6-1.3-1.3L7.6 7.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SettingsSectionHead({ id, title, description, icon, tone = 'default' }: Props) {
  return (
    <div
      className={
        tone === 'danger'
          ? 'settings-section-head settings-section-head--danger'
          : 'settings-section-head'
      }
    >
      <span className="settings-section-head__icon" aria-hidden>
        <SettingsSectionIcon name={icon} />
      </span>
      <div className="settings-section-head__copy">
        <h2 id={id} className="section-title">
          {title}
        </h2>
        {description ? <p className="settings-section-head__desc">{description}</p> : null}
      </div>
    </div>
  );
}
