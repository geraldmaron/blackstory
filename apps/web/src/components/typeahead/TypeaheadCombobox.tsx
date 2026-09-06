/**
 * Accessible typeahead listbox for search/books fields. Controlled value + deferred
 * suggestions; keyboard (arrow/enter/escape) and aria-autocomplete=list.
 *
 * The remote lane is DEBOUNCED and the local lane is not, and that asymmetry is the point.
 * `suggestLocal` ranks an array already in memory, so waiting would only add lag. `suggestRemote`
 * costs a request against `/search/api`, whose anonymous quota is a per-minute window — one
 * request per keystroke spent that whole window on a single typed phrase and left the reader
 * rate-limited mid-word. One request per pause spends it on searches instead.
 *
 * The controller each effect run creates is now handed to the suggestor, so a superseded request
 * is actually cancelled rather than merely ignored on arrival. The endpoint caps concurrent
 * in-flight requests per caller, so an abandoned request that keeps running is a slot the
 * reader's next keystroke gets denied for.
 *
 * A failed lookup is not an empty one. When the suggestor throws — offline, rate-limited, a 5xx —
 * the field says so instead of rendering the silence as "No matching suggestions", which told the
 * reader the archive holds nothing about the thing they were halfway through typing.
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

/**
 * Said to a reader whose lookup failed. It names the fallback rather than the cause, because the
 * cause (rate limit, offline, 5xx) is not something the reader can act on and the fallback is.
 */
const UNAVAILABLE_NOTE = 'Suggestions are unavailable right now — press Enter to search.';

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
  /** Lets a host position the dropdown; the bar's floats over the page, a filter's does not. */
  readonly listClassName?: string;
  readonly minChars?: number;
  /** Quiet period before a remote lookup fires. Ignored by the local lane, which is free. */
  readonly remoteDebounceMs?: number;
  /** Sync suggestor — used when suggestions are derived locally (books). */
  readonly suggestLocal?: (query: string) => readonly TypeaheadSuggestion[];
  /**
   * Async suggestor — used when suggestions come from an API (search). Receives the abort signal
   * for the current keystroke and MUST pass it to `fetch`. Throwing marks the lane unavailable;
   * returning `[]` means the query genuinely matched nothing.
   */
  readonly suggestRemote?: (
    query: string,
    signal: AbortSignal,
  ) => Promise<readonly TypeaheadSuggestion[]>;
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
  listClassName,
  minChars = 2,
  remoteDebounceMs = 220,
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
  /** True when the last remote lookup failed, so the field can say so rather than say "none". */
  const [unavailable, setUnavailable] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const trimmed = deferredQuery.trim();
    if (trimmed.length < minChars) {
      setSuggestions([]);
      setActiveIndex(-1);
      setUnavailable(false);
      return;
    }

    if (suggestLocal) {
      setSuggestions(suggestLocal(trimmed));
      setActiveIndex(-1);
      setUnavailable(false);
      return;
    }

    if (!suggestRemote) return;

    // One controller per effect run, aborted by this run's own cleanup. The previous version kept
    // it in a ref and aborted the *previous* controller on the way in, which left the final
    // keystroke's request running after unmount.
    const controller = new AbortController();
    let cancelled = false;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const next = await suggestRemote(trimmed, controller.signal);
          if (cancelled || controller.signal.aborted) return;
          setSuggestions(next);
          setActiveIndex(-1);
          setUnavailable(false);
        } catch {
          // An abort lands here too, and an abort is not a failure: the reader simply kept typing.
          if (cancelled || controller.signal.aborted) return;
          setSuggestions([]);
          setActiveIndex(-1);
          setUnavailable(true);
        }
      })();
    }, remoteDebounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [deferredQuery, minChars, remoteDebounceMs, suggestLocal, suggestRemote]);

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

  const showUnavailable = unavailable && suggestions.length === 0;

  const statusMessage =
    deferredQuery.trim().length < minChars
      ? ''
      : showUnavailable
        ? UNAVAILABLE_NOTE
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
      {showUnavailable && open ? (
        <p className="ds-typeahead__note" role="status">
          {UNAVAILABLE_NOTE}
        </p>
      ) : null}
      {showList ? (
        <ul
          id={listboxId}
          className={listClassName ? `ds-typeahead__list ${listClassName}` : 'ds-typeahead__list'}
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
                  <span className="ds-typeahead__primary" title={suggestion.primary}>
                    {suggestion.primary}
                  </span>
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
