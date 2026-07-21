/**
 * Accessible typeahead listbox for search/books fields. Controlled value + deferred
 * suggestions; keyboard (arrow/enter/escape) and aria-autocomplete=list.
 */
'use client';

import React, {
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export type TypeaheadSuggestion = {
  readonly id: string;
  readonly primary: string;
  readonly secondary?: string;
  readonly href?: string;
};

export type TypeaheadComboboxProps = {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly hideLabel?: boolean;
  readonly labelClassName?: string;
  readonly placeholder?: string;
  readonly defaultValue?: string;
  readonly className?: string;
  readonly inputClassName?: string;
  readonly listLabel: string;
  readonly minChars?: number;
  /** Sync suggestor — used when suggestions are derived locally (books). */
  readonly suggestLocal?: (query: string) => readonly TypeaheadSuggestion[];
  /** Async suggestor — used when suggestions come from an API (search). */
  readonly suggestRemote?: (query: string) => Promise<readonly TypeaheadSuggestion[]>;
  /** When a suggestion is activated: navigate or fill. Default fills the input. */
  readonly onPick?: (suggestion: TypeaheadSuggestion) => void;
  readonly children?: ReactNode;
};

export function TypeaheadCombobox({
  id,
  name,
  label,
  hideLabel = false,
  labelClassName,
  placeholder,
  defaultValue = '',
  className,
  inputClassName,
  listLabel,
  minChars = 2,
  suggestLocal,
  suggestRemote,
  onPick,
  children,
}: TypeaheadComboboxProps) {
  const listboxId = useId();
  const statusId = useId();
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<readonly TypeaheadSuggestion[]>([]);
  const deferredQuery = useDeferredValue(query);
  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const trimmed = deferredQuery.trim();
    if (trimmed.length < minChars) {
      setSuggestions([]);
      setActiveIndex(-1);
      return;
    }

    if (suggestLocal) {
      setSuggestions(suggestLocal(trimmed));
      setActiveIndex(-1);
      return;
    }

    if (!suggestRemote) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let cancelled = false;

    void (async () => {
      try {
        const next = await suggestRemote(trimmed);
        if (cancelled || controller.signal.aborted) return;
        setSuggestions(next);
        setActiveIndex(-1);
      } catch {
        if (cancelled || controller.signal.aborted) return;
        setSuggestions([]);
        setActiveIndex(-1);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [deferredQuery, minChars, suggestLocal, suggestRemote]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const showList = open && suggestions.length > 0;

  function pick(suggestion: TypeaheadSuggestion) {
    setQuery(suggestion.primary);
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
    if (onPick) {
      onPick(suggestion);
      return;
    }
    if (suggestion.href) {
      window.location.assign(suggestion.href);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!showList) return;

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
    if (event.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      pick(suggestions[activeIndex]!);
    }
  }

  const statusMessage =
    deferredQuery.trim().length < minChars
      ? ''
      : suggestions.length === 0
        ? 'No matching suggestions'
        : `${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'} available`;

  return (
    <div className={className ?? 'ds-typeahead'} ref={rootRef}>
      <label
        className={hideLabel ? 'ds-visually-hidden' : (labelClassName ?? undefined)}
        htmlFor={id}
      >
        {label}
      </label>
      <input
        id={id}
        className={inputClassName}
        type="search"
        name={name}
        autoComplete="off"
        enterKeyHint="search"
        placeholder={placeholder}
        value={query}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={showList}
        aria-activedescendant={
          showList && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        aria-describedby={statusId}
        onChange={(event) => {
          setQuery(event.currentTarget.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {children}
      <p className="ds-visually-hidden" id={statusId} aria-live="polite">
        {statusMessage}
      </p>
      {showList ? (
        <ul
          id={listboxId}
          className="ds-typeahead__list"
          role="listbox"
          aria-label={listLabel}
        >
          {suggestions.map((suggestion, index) => {
            const selected = index === activeIndex;
            return (
              <li key={suggestion.id} role="presentation">
                <button
                  type="button"
                  id={`${listboxId}-option-${index}`}
                  className={
                    selected
                      ? 'ds-typeahead__option ds-typeahead__option--active'
                      : 'ds-typeahead__option'
                  }
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => pick(suggestion)}
                >
                  <span className="ds-typeahead__primary">{suggestion.primary}</span>
                  {suggestion.secondary ? (
                    <span className="ds-mono ds-typeahead__secondary">{suggestion.secondary}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
