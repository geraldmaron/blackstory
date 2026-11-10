'use client';
/**
 * Floating surfaces for the manuscript editor: a fixed-position panel that is never clipped by
 * an overflow ancestor, a keyboard-driven listbox, and the record search the `@` menu and the
 * Record button share.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useAdminAuth } from '@/admin/auth/AdminAuthProvider';
import { rememberRecords, type RecordHit } from './record-session';

export type Rect = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

const GAP = 6;
const MARGIN = 8;

/**
 * Fixed-position panel anchored to a rectangle (the caret, a selection, a button). It opens
 * below the anchor, flips above when there is no room, and follows scrolling and resizing.
 * Pointer presses outside it call `onDismiss`.
 */
export function FloatingPanel({
  getRect,
  children,
  className,
  label,
  role = 'dialog',
  onDismiss,
  ignore,
}: {
  getRect: () => Rect | null;
  children: ReactNode;
  className?: string;
  label: string;
  role?: 'dialog' | 'group';
  onDismiss?: () => void;
  /** Elements whose own handlers own the open state (the button that toggles this panel). */
  ignore?: () => Element | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ left: number; top: number } | null>(null);
  const reposition = useCallback(() => {
    const rect = getRect();
    const panel = ref.current;
    if (!rect || !panel) return;
    const { width, height } = panel.getBoundingClientRect();
    const below = rect.bottom + GAP;
    const top =
      below + height > window.innerHeight - MARGIN && rect.top - GAP - height > MARGIN
        ? rect.top - GAP - height
        : below;
    const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - width - MARGIN));
    setStyle((previous) =>
      previous && previous.left === left && previous.top === top ? previous : { left, top },
    );
  }, [getRect]);
  // Measure after every render: the panel's height changes as results arrive.
  useLayoutEffect(() => {
    reposition();
  });
  useEffect(() => {
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [reposition]);
  useEffect(() => {
    if (!onDismiss) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || ref.current?.contains(target) || ignore?.()?.contains(target)) return;
      onDismiss();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [onDismiss, ignore]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={ref}
      role={role}
      aria-label={label}
      className={`rd-panel${className ? ` ${className}` : ''}`}
      style={{
        left: style?.left ?? 0,
        top: style?.top ?? 0,
        /* opacity, not visibility: a hidden field cannot take focus on mount */ opacity: style
          ? undefined
          : 0,
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && onDismiss) {
          event.stopPropagation();
          onDismiss();
        }
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export type MenuOption = {
  readonly key: string;
  readonly node: ReactNode;
  readonly onPick: () => void;
  /** Draws a rule above this option. */
  readonly separatorBefore?: boolean;
};

export type MenuListHandle = {
  /** Arrow keys move, Enter or Tab picks. False means the key is not for the list. */
  onKeyDown: (event: KeyboardEvent) => boolean;
};

/**
 * A listbox whose focus stays wherever the writer is typing (the editor or a filter input);
 * `onActiveId` lets that element expose the highlighted option through aria-activedescendant.
 */
export const MenuList = forwardRef<
  MenuListHandle,
  {
    options: readonly MenuOption[];
    label: string;
    status?: ReactNode;
    onActiveId?: (id: string | null) => void;
  }
>(function MenuList({ options, label, status, onActiveId }, handle) {
  const base = useId();
  const [active, setActive] = useState(0);
  const signature = options.map((option) => option.key).join('|');
  useEffect(() => setActive(0), [signature]);
  const activeId = options.length ? `${base}-${Math.min(active, options.length - 1)}` : null;
  useEffect(() => {
    onActiveId?.(activeId);
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId, onActiveId]);
  useEffect(() => () => onActiveId?.(null), [onActiveId]);
  useImperativeHandle(
    handle,
    () => ({
      onKeyDown(event) {
        if (!options.length) return false;
        if (event.key === 'ArrowDown') setActive((index) => (index + 1) % options.length);
        else if (event.key === 'ArrowUp')
          setActive((index) => (index - 1 + options.length) % options.length);
        else if (event.key === 'Enter' || event.key === 'Tab')
          options[Math.min(active, options.length - 1)]?.onPick();
        else return false;
        return true;
      },
    }),
    [options, active],
  );
  return (
    <>
      {options.length ? (
        <ul role="listbox" aria-label={label} className="rd-list">
          {options.map((option, index) => (
            <li
              key={option.key}
              id={`${base}-${index}`}
              role="option"
              aria-selected={index === active}
              className={`rd-list__option${index === active ? ' rd-list__option--active' : ''}${option.separatorBefore ? ' rd-list__option--rule' : ''}`}
              // Keeps the caret in the editor or filter field while the pointer picks.
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => setActive(index)}
              onClick={option.onPick}
            >
              {option.node}
            </li>
          ))}
        </ul>
      ) : null}
      {status ? (
        <p className="rd-list__status" role="status">
          {status}
        </p>
      ) : null}
    </>
  );
});

/**
 * A panel with a filter field above a list, opened from a toolbar button. Focus sits in the
 * field; the list never takes it.
 */
export function PickerPopover({
  getRect,
  ignore,
  label,
  placeholder,
  onClose,
  children,
}: {
  getRect: () => Rect | null;
  ignore?: () => Element | null;
  label: string;
  placeholder: string;
  onClose: () => void;
  children: (
    query: string,
    list: React.RefObject<MenuListHandle | null>,
    setActive: (id: string | null) => void,
  ) => ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const list = useRef<MenuListHandle>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  return (
    <FloatingPanel
      getRect={getRect}
      label={label}
      onDismiss={onClose}
      {...(ignore ? { ignore } : {})}
    >
      <input
        ref={input}
        className="rd-field"
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-label={label}
        aria-autocomplete="list"
        aria-activedescendant={activeId ?? undefined}
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (list.current?.onKeyDown(event.nativeEvent)) event.preventDefault();
        }}
      />
      {children(query, list, setActiveId)}
    </FloatingPanel>
  );
}

const KIND_LABELS: Readonly<Record<string, string>> = {
  person: 'Person',
  place: 'Place',
  organization: 'Organization',
  event: 'Event',
};
const kindLabel = (kind: string | null) =>
  kind
    ? (KIND_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1).replace(/_/g, ' '))
    : 'Record';

/** Debounced, abortable search of the record catalog. */
function useRecordSearch(query: string) {
  const { getIdToken } = useAdminAuth();
  const [state, setState] = useState<{
    hits: RecordHit[];
    loading: boolean;
    error: string;
    forQuery: string;
  }>({ hits: [], loading: false, error: '', forQuery: '' });
  const search = query.trim();
  useEffect(() => {
    if (search.length < 2) {
      setState({ hits: [], loading: false, error: '', forQuery: '' });
      return;
    }
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const token = await getIdToken();
          if (!token) throw new Error('Sign in again to find records. Your text is kept here.');
          const response = await fetch(
            `/admin/api/editorial/entities?q=${encodeURIComponent(search)}`,
            { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
          );
          const data = (await response.json()) as { items?: RecordHit[]; error?: string };
          if (!response.ok) throw new Error(data.error ?? 'Records could not be loaded.');
          if (controller.signal.aborted) return;
          const hits = data.items ?? [];
          rememberRecords(hits);
          setState({ hits, loading: false, error: '', forQuery: search });
        } catch (failure) {
          if (controller.signal.aborted) return;
          setState({
            hits: [],
            loading: false,
            error: failure instanceof Error ? failure.message : 'Records could not be loaded.',
            forQuery: search,
          });
        }
      })();
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, getIdToken]);
  return { ...state, search };
}

/** Results for the `@` menu and the Record button: name, then a quiet line of kind and place. */
export const RecordPicker = forwardRef<
  MenuListHandle,
  { query: string; onPick: (record: RecordHit) => void; onActiveId?: (id: string | null) => void }
>(function RecordPicker({ query, onPick, onActiveId }, handle) {
  const { hits, loading, error, search, forQuery } = useRecordSearch(query);
  const options: MenuOption[] = hits.map((hit) => ({
    key: hit.id,
    onPick: () => onPick(hit),
    node: (
      <span className="rd-list__text">
        <span className="rd-list__name">{hit.display_name}</span>
        <span className="rd-list__line">
          {[kindLabel(hit.kind), hit.place].filter(Boolean).join(' · ')}
          {hit.published ? '' : <span className="rd-list__flag"> Not public yet</span>}
        </span>
      </span>
    ),
  }));
  const status =
    search.length < 2
      ? 'Type at least two letters of a name.'
      : error
        ? error
        : loading && forQuery !== search
          ? 'Searching…'
          : hits.length === 0
            ? `No record matches “${search}”.`
            : null;
  return (
    <MenuList
      ref={handle}
      options={error || search.length < 2 ? [] : options}
      label="Records"
      status={status}
      {...(onActiveId ? { onActiveId } : {})}
    />
  );
});
