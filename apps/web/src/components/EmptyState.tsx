import type { ReactNode } from 'react';

type Props = {
  title: string;
  body: string;
  actions?: ReactNode;
};

export function EmptyState({ title, body, actions }: Props) {
  return (
    <section className="empty-panel" role="status">
      <h2 className="empty-panel__title">{title}</h2>
      <p className="empty-panel__body">{body}</p>
      {actions ? <div className="empty-panel__actions">{actions}</div> : null}
    </section>
  );
}
