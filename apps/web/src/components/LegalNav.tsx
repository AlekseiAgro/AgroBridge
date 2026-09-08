import { LEGAL_DOC_SLUGS, type LegalDocSlug } from '@agrobridge/shared';
import { Link } from '@/i18n/navigation';

type Props = {
  labels: Record<LegalDocSlug, string>;
  current?: LegalDocSlug;
  navLabel: string;
};

export function LegalNav({ labels, current, navLabel }: Props) {
  return (
    <nav className="legal-nav" aria-label={navLabel}>
      {LEGAL_DOC_SLUGS.map((slug) => (
        <Link
          key={slug}
          href={`/legal/${slug}`}
          className={current === slug ? 'legal-nav__link legal-nav__link--active' : 'legal-nav__link'}
        >
          {labels[slug]}
        </Link>
      ))}
    </nav>
  );
}
