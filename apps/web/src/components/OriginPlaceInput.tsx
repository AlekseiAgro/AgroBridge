'use client';

import {
  PLACE_AUTOCOMPLETE_MIN_CHARS,
  type PlaceSuggestion,
  type PlacesAutocompleteResponse,
} from '@agrobridge/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

type Props = {
  value: string;
  country: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function OriginPlaceInput({ value, country, onChange, placeholder }: Props) {
  const t = useTranslations('product');
  const locale = useLocale();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const query = value.trim();
    if (query.length < PLACE_AUTOCOMPLETE_MIN_CHARS) {
      setSuggestions([]);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({
        q: query,
        language: locale,
        country,
      });

      void fetch(`/api/places/autocomplete?${params.toString()}`, {
        signal: controller.signal,
        cache: 'no-store',
      })
        .then(async (response) => {
          if (!response.ok) {
            setSuggestions([]);
            return;
          }
          const data = (await response.json()) as PlacesAutocompleteResponse;
          if (!data.enabled) {
            setEnabled(false);
            setSuggestions([]);
            setOpen(false);
            return;
          }
          setSuggestions(data.suggestions);
          setActiveIndex(data.suggestions.length > 0 ? 0 : -1);
          setOpen(true);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setSuggestions([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value, country, locale, enabled]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  function selectSuggestion(suggestion: PlaceSuggestion) {
    onChange(suggestion.mainText);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
      return;
    }
    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]!);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const showList = open && enabled && suggestions.length > 0;

  return (
    <div className="place-autocomplete" ref={rootRef}>
      <div className="place-autocomplete__control">
        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
        />
        {showList ? (
          <ul className="place-autocomplete__list" id={listId} role="listbox">
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.placeId} role="presentation">
                <button
                  type="button"
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={
                    index === activeIndex
                      ? 'place-autocomplete__option place-autocomplete__option--active'
                      : 'place-autocomplete__option'
                  }
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectSuggestion(suggestion)}
                >
                  <span className="place-autocomplete__main">{suggestion.mainText}</span>
                  {suggestion.secondaryText ? (
                    <span className="place-autocomplete__secondary">{suggestion.secondaryText}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {enabled && loading ? (
        <p className="place-autocomplete__status" aria-live="polite">
          {t('originPlaceSearching')}
        </p>
      ) : null}
    </div>
  );
}
