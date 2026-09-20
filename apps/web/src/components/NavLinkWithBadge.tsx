import { ChatUnreadBadge } from '@/components/ChatNavLink';
import { Link } from '@/i18n/navigation';

type Props = {
  href: string;
  label: string;
  unreadLabel: string;
  count: number;
};

export function NavLinkWithBadge({ href, label, unreadLabel, count }: Props) {
  return (
    <Link
      href={href}
      className={['chat-nav-link', count > 0 ? 'chat-nav-link--has-unread' : ''].filter(Boolean).join(' ')}
      aria-label={count > 0 ? unreadLabel : label}
    >
      <span className="chat-nav-link__label">{label}</span>
      <ChatUnreadBadge count={count} />
    </Link>
  );
}
