import { SUPPORT_EMAIL } from '@agrobridge/shared';
import { Link } from '@/i18n/navigation';
import { interpolateLegal, type LegalDocContent } from '@/lib/legal';

type Props = {
  doc: LegalDocContent;
  supportLabel: string;
  vars?: Record<string, string>;
};

export function LegalDocument({
  doc,
  supportLabel,
  vars = { email: SUPPORT_EMAIL },
}: Props) {
  return (
    <article className="legal-doc">
      {doc.sections.map((section) => (
        <section key={section.title} className="legal-doc__section">
          <h2>{section.title}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph.slice(0, 80)}>{interpolateLegal(paragraph, vars)}</p>
          ))}
        </section>
      ))}
      <p className="legal-doc__contact">
        <Link href="/support" className="text-link">
          {supportLabel}
        </Link>
        {' · '}
        <a className="text-link" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
      </p>
    </article>
  );
}
