import { Link } from '@/i18n/navigation';
import { ChatNavLink } from '@/components/ChatNavLink';

export type RoleHubPath = {
  href: string;
  title: string;
  text: string;
  cta: string;
  imageSrc: string;
  imageAlt?: string;
};

type Props = {
  eyebrow: string;
  title: string;
  lead: string;
  paths: [RoleHubPath, RoleHubPath];
  asideNote?: string;
  asideLinks?: Array<{ href: string; label: string }>;
  chatUnreadCount?: number;
};

export function RoleHub({
  eyebrow,
  title,
  lead,
  paths,
  asideNote,
  asideLinks,
  chatUnreadCount = 0,
}: Props) {
  return (
    <section className="role-hub">
      <header className="role-hub__intro">
        <p className="role-hub__eyebrow">{eyebrow}</p>
        <h1 className="role-hub__title">{title}</h1>
        <p className="role-hub__lead">{lead}</p>
      </header>

      <div className="role-hub__paths">
        {paths.map((path, index) => (
          <Link
            key={path.href}
            href={path.href}
            className={`role-hub__path role-hub__path--${index === 0 ? 'primary' : 'secondary'}`}
          >
            <span className="role-hub__path-media" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={path.imageSrc} alt="" className="role-hub__path-image" />
              <span className="role-hub__path-veil" />
            </span>
            <span className="role-hub__path-body">
              <span className="role-hub__path-title">{path.title}</span>
              <span className="role-hub__path-text">{path.text}</span>
              <span className="role-hub__path-cta">{path.cta}</span>
            </span>
          </Link>
        ))}
      </div>

      {asideNote || (asideLinks && asideLinks.length > 0) ? (
        <footer className="role-hub__aside">
          {asideNote ? <p className="role-hub__aside-note">{asideNote}</p> : null}
          {asideLinks && asideLinks.length > 0 ? (
            <div className="role-hub__aside-links">
              {asideLinks.map((link) =>
                link.href === '/dashboard/chat' ? (
                  <ChatNavLink
                    key={link.href}
                    className="button button--ghost"
                    label={link.label}
                    initialCount={chatUnreadCount}
                  />
                ) : (
                  <Link key={link.href} href={link.href} className="button button--ghost">
                    {link.label}
                  </Link>
                ),
              )}
            </div>
          ) : null}
        </footer>
      ) : null}
    </section>
  );
}
