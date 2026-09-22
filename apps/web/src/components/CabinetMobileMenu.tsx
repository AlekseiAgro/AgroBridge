'use client';

import { usePathname } from '@/i18n/navigation';
import { useEffect, useId, useState, type ReactNode } from 'react';

type Props = {
  openLabel: string;
  closeLabel: string;
  children: ReactNode;
};

export function CabinetMobileMenu({ openLabel, closeLabel, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const titleId = useId();
  const panelId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const previousOverflowY = document.body.style.overflowY;
    document.body.style.overflowY = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflowY = previousOverflowY;
    };
  }, [open]);

  return (
    <div className="cabinet__mobile-nav">
      <button
        type="button"
        className="cabinet__menu-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
      >
        <span className="cabinet__menu-icon" aria-hidden="true" />
        <span className="sr-only">{openLabel}</span>
      </button>
      {open ? (
        <div className="cabinet__drawer-root">
          <button
            type="button"
            className="cabinet__drawer-backdrop"
            aria-label={closeLabel}
            onClick={() => setOpen(false)}
          />
          <div
            id={panelId}
            className="cabinet__drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="cabinet__drawer-head">
              <p id={titleId} className="cabinet__eyebrow">
                {openLabel}
              </p>
              <button type="button" className="cabinet__drawer-close" onClick={() => setOpen(false)}>
                {closeLabel}
              </button>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
