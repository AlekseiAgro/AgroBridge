import { Link } from '@/i18n/navigation';

type Props = {
  lead: string;
  text: string;
  cta: string;
  href: string;
  variant?: 'primary' | 'accent';
};

export function FloatingCta({ lead, text, cta, href, variant = 'primary' }: Props) {
  const buttonClass =
    variant === 'accent'
      ? 'button button--accent floating-cta__button'
      : 'button button--primary floating-cta__button';

  return (
    <aside className="floating-cta" aria-label={cta}>
      <div className="floating-cta__inner">
        <div className="floating-cta__copy">
          <p className="floating-cta__lead">{lead}</p>
          <p className="floating-cta__text">{text}</p>
        </div>
        <Link href={href} className={buttonClass}>
          {cta}
        </Link>
      </div>
    </aside>
  );
}
