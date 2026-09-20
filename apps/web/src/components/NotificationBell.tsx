import { Link } from '@/i18n/navigation';

type Props = {
  count: number;
  label: string;
  unreadLabel: string;
};

function formatCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
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

export function NotificationBell({ count, label, unreadLabel }: Props) {
  return (
    <Link
      href="/dashboard/subscriptions#inbox"
      className={['notification-bell', count > 0 ? 'notification-bell--unread' : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={count > 0 ? unreadLabel : label}
    >
      <BellIcon />
      {count > 0 ? (
        <span className="notification-bell__badge" aria-hidden>
          {formatCount(count)}
        </span>
      ) : null}
    </Link>
  );
}
