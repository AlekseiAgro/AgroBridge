import { Link } from '@/i18n/navigation';

export type PublicBreadcrumbLink = {
  href: string;
  label: string;
};

type Props = {
  ariaLabel: string;
  items: PublicBreadcrumbLink[];
  current: string;
};

/** Visible public trail. Ancestors are links; the current page is text. */
export function PublicBreadcrumbs({ ariaLabel, items, current }: Props) {
  return (
    <nav className="breadcrumbs" aria-label={ariaLabel}>
      <ol className="breadcrumbs__list">
        {items.map((item) => (
          <li key={item.href} className="breadcrumbs__item">
            <Link href={item.href}>{item.label}</Link>
          </li>
        ))}
        <li className="breadcrumbs__item">
          <span className="breadcrumbs__current" aria-current="page">
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}
