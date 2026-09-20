'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { LegalDocumentView } from '@/content/legal';

type Props = {
  document: LegalDocumentView;
  headingLevel?: 'h1' | 'h2';
  headingId?: string;
};

function isSafeLegalHref(href: string) {
  return href.startsWith('https://agrobridge.ge') || href === 'mailto:support@agrobridge.ge';
}

function LegalInline({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text))) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }

    if (match[0].startsWith('**')) {
      nodes.push(
        <strong key={index}>
          <LegalInline text={match[2] ?? ''} />
        </strong>,
      );
    } else {
      const label = match[3] ?? '';
      const href = match[4] ?? '';
      nodes.push(
        isSafeLegalHref(href) ? (
          <a key={index} href={href} className="legal-document__link">
            <LegalInline text={label} />
          </a>
        ) : (
          <LegalInline key={index} text={label} />
        ),
      );
    }

    index += 1;
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return nodes;
}

function renderBlocks(paragraphs: string[], sectionHeading: 'h2' | 'h3') {
  const SectionHeading = sectionHeading;
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];

  function flushList(key: string) {
    if (listItems.length === 0) {
      return;
    }
    nodes.push(
      <ul key={key} className="legal-document__list">
        {listItems.map((item, index) => (
          <li key={`${key}-${index}`}>
            <LegalInline text={item} />
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  paragraphs.forEach((paragraph, index) => {
    if (paragraph.startsWith('- ')) {
      listItems.push(paragraph.slice(2));
      return;
    }

    flushList(`list-${index}`);

    if (paragraph.startsWith('## ')) {
      nodes.push(
        <SectionHeading key={`h-${index}`} className="legal-document__section">
          <LegalInline text={paragraph.slice(3)} />
        </SectionHeading>,
      );
      return;
    }

    nodes.push(
      <p key={`p-${index}`}>
        <LegalInline text={paragraph} />
      </p>,
    );
  });

  flushList('list-end');
  return nodes;
}

export function LegalDocumentArticle({ document, headingLevel = 'h1', headingId }: Props) {
  const t = useTranslations('legal');
  const Heading = headingLevel;
  const sectionHeading = headingLevel === 'h1' ? 'h2' : 'h3';

  return (
    <article className="legal-document">
      <header className="legal-document__header">
        <Heading id={headingId} className="legal-document__title">
          {document.title}
        </Heading>
        {document.version ? (
          <p className="legal-document__version">{t('version', { version: document.version })}</p>
        ) : null}
        {document.effectiveDate ? (
          <p className="legal-document__version">{t('effectiveDate', { date: document.effectiveDate })}</p>
        ) : null}
      </header>
      <div className="legal-document__body">
        {document.pending ? (
          <p className="legal-document__pending">{t('documentPending')}</p>
        ) : (
          renderBlocks(document.paragraphs, sectionHeading)
        )}
      </div>
    </article>
  );
}
