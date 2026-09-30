import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

type Props = {
  href: string;
  name: string;
  place?: string | null;
  badge?: ReactNode;
};

/** Farm or seller name as its own link, with the place on the next line. */
export function FarmLink({ href, name, place, badge }: Props) {
  return (
    <span className="farm-link">
      <span className="farm-link__row">
        <Link href={href} className="farm-link__name">
          {name}
          <span aria-hidden="true"> →</span>
        </Link>
        {badge}
      </span>
      {place ? <span className="farm-link__place">{place}</span> : null}
    </span>
  );
}
