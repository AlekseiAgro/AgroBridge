'use client';

import { useEffect, useId, useRef, useState } from 'react';

export type MultiSelectOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  label: string;
  options: MultiSelectOption<T>[];
  values: T[];
  onChange: (values: T[]) => void;
  placeholder: string;
  selectedSummary: string;
};

export function MultiSelectDropdown<T extends string>({
  label,
  options,
  values,
  onChange,
  placeholder,
  selectedSummary,
}: Props<T>) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  function toggle(value: T) {
    onChange(
      values.includes(value) ? values.filter((item) => item !== value) : [...values, value],
    );
  }

  return (
    <div className="field multi-select" ref={rootRef}>
      <span id={`${listId}-label`}>{label}</span>
      <button
        type="button"
        className="multi-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${listId}-label`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={values.length ? undefined : 'multi-select__placeholder'}>
          {values.length ? selectedSummary : placeholder}
        </span>
        <span className="multi-select__chevron" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <ul className="multi-select__menu" role="listbox" aria-multiselectable="true">
          {options.map((option) => {
            const selected = values.includes(option.value);
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <label className="multi-select__option">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggle(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
