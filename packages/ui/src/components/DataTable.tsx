/**
 * Dense, selectable, keyboard-navigable table for operator surfaces.
 *
 * Sorting and paging are plain links, not client state — the consuming page is a server
 * component, so a header click is a navigation that returns already-rendered rows rather than a
 * fetch waterfall. Only row selection is client state, because it has no URL meaning.
 *
 * Keyboard model follows the conventions operators already know from mail and issue trackers:
 * j/k or arrows move the cursor, x toggles selection, shift+x extends a range, Enter opens the
 * row, and a/Escape select-all/clear. The cursor is roving tabindex, so Tab still leaves the
 * table in one press instead of walking every row.
 */

'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cx } from '../utils/cx.js';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type DataTableColumn<Row> = {
  readonly id: string;
  readonly header: ReactNode;
  readonly cell: (row: Row) => ReactNode;
  /** When set, the header renders as a sort link to this href. */
  readonly sortHref?: string;
  readonly sortDirection?: 'asc' | 'desc';
  /** Right-aligns numeric columns so digits line up down the column. */
  readonly align?: 'start' | 'end';
  readonly width?: string;
  /** Hidden below the compact breakpoint rather than squeezed. */
  readonly secondary?: boolean;
};

export type DataTableProps<Row> = {
  readonly caption: string;
  readonly rows: readonly Row[];
  readonly columns: readonly DataTableColumn<Row>[];
  readonly rowKey: (row: Row) => string;
  /** Enables the selection column and the keyboard selection verbs. */
  readonly selectedIds?: ReadonlySet<string>;
  readonly onSelectionChange?: (next: ReadonlySet<string>) => void;
  /** Enter on the cursor row navigates here. */
  readonly rowHref?: (row: Row) => string;
  readonly onRowActivate?: (row: Row) => void;
  readonly density?: 'comfortable' | 'compact';
  readonly emptyState?: ReactNode;
  /**
   * Row count above which the body windows instead of rendering every row. Set to `Infinity` to
   * never virtualize (printing, tests, a page that must be Ctrl-F-able end to end).
   */
  readonly virtualizeAbove?: number;
  /** Height of the scroll viewport once virtualized. */
  readonly viewportHeight?: string;
  readonly className?: string;
};

/** Measured row heights in px, used to size the windowed viewport and its spacers. */
const ROW_HEIGHT = { compact: 33, comfortable: 41 } as const;

/** Rows rendered beyond each edge of the viewport, so a fast scroll does not show blank bands. */
const OVERSCAN = 8;

/**
 * The slice of rows to render for a given scroll position, and the spacer heights that stand in
 * for the rest. Pure so the windowing arithmetic can be tested without a layout engine — the
 * failure mode being guarded is an off-by-one that blanks the row under the cursor.
 */
export function computeRowWindow(options: {
  readonly rowCount: number;
  readonly rowHeight: number;
  readonly scrollTop: number;
  readonly viewportRows: number;
  readonly overscan?: number;
}): { readonly first: number; readonly last: number } {
  const { rowCount, rowHeight, scrollTop, viewportRows } = options;
  const overscan = options.overscan ?? OVERSCAN;
  const first = Math.max(0, Math.floor(Math.max(0, scrollTop) / rowHeight) - overscan);
  const last = Math.min(rowCount, first + viewportRows + overscan * 2);
  return { first, last };
}

export function DataTable<Row>({
  caption,
  rows,
  columns,
  rowKey,
  selectedIds,
  onSelectionChange,
  rowHref,
  onRowActivate,
  density = 'compact',
  emptyState,
  virtualizeAbove = 200,
  viewportHeight = '70vh',
  className,
}: DataTableProps<Row>) {
  const selectable = Boolean(selectedIds && onSelectionChange);
  const [cursor, setCursor] = useState(0);
  // Anchor for shift+x range selection, mirroring how file lists behave.
  const anchorRef = useRef<number | null>(null);
  const bodyRef = useRef<HTMLTableSectionElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const virtualized = rows.length > virtualizeAbove;
  const rowHeight = ROW_HEIGHT[density];
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportRows, setViewportRows] = useState(40);

  // Cursor moves are applied after render, not during: with a windowed body the target row may
  // not exist in the DOM yet, so focusing synchronously would silently do nothing.
  const pendingFocusRef = useRef(false);

  const { first, last } = virtualized
    ? computeRowWindow({ rowCount: rows.length, rowHeight, scrollTop, viewportRows })
    : { first: 0, last: rows.length };
  const visibleRows = virtualized ? rows.slice(first, last) : rows;

  useEffect(() => {
    if (!virtualized) return;
    const node = scrollRef.current;
    if (!node) return;
    function measure() {
      const height = node?.clientHeight ?? 0;
      if (height > 0) setViewportRows(Math.ceil(height / rowHeight));
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [virtualized, rowHeight]);

  // A filter or page change swaps the row set underneath the cursor; parking it at the top is
  // the only position guaranteed to still exist.
  useEffect(() => {
    setCursor(0);
    anchorRef.current = null;
    // The scroll position has to go back with the cursor, or a new filter opens mid-table.
    setScrollTop(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [rows]);

  const setSelection = useCallback(
    (next: ReadonlySet<string>) => onSelectionChange?.(next),
    [onSelectionChange],
  );

  const toggle = useCallback(
    (id: string) => {
      if (!selectedIds) return;
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelection(next);
    },
    [selectedIds, setSelection],
  );

  const selectRange = useCallback(
    (from: number, to: number) => {
      if (!selectedIds) return;
      const next = new Set(selectedIds);
      const [lo, hi] = from <= to ? [from, to] : [to, from];
      for (let index = lo; index <= hi; index += 1) {
        const row = rows[index];
        if (row) next.add(rowKey(row));
      }
      setSelection(next);
    },
    [rows, rowKey, selectedIds, setSelection],
  );

  const move = useCallback(
    (delta: number) => {
      setCursor((current) => {
        const next = Math.min(Math.max(0, current + delta), Math.max(0, rows.length - 1));
        if (next !== current) pendingFocusRef.current = true;
        // Scroll the target into view here rather than after focus: a windowed body has to be
        // told to render the row before anything can be focused inside it.
        if (virtualized && scrollRef.current) {
          const node = scrollRef.current;
          const top = next * rowHeight;
          if (top < node.scrollTop) node.scrollTop = top;
          else if (top + rowHeight > node.scrollTop + node.clientHeight) {
            node.scrollTop = top + rowHeight - node.clientHeight;
          }
        }
        return next;
      });
    },
    [rows.length, virtualized, rowHeight],
  );

  // Focus follows the cursor once the row it points at has actually rendered. `data-row-index`
  // is the lookup key because with a windowed body the DOM index and the row index differ.
  useEffect(() => {
    if (!pendingFocusRef.current) return;
    const element = bodyRef.current?.querySelector<HTMLTableRowElement>(
      `tr[data-row-index="${cursor}"]`,
    );
    if (element) {
      element.focus();
      pendingFocusRef.current = false;
    }
  }, [cursor, first, last]);

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>, index: number, row: Row) {
    // Never swallow keys aimed at a control inside the row (a link, a checkbox, an input).
    const target = event.target as HTMLElement;
    if (target !== event.currentTarget && target.closest('input, button, a, select, textarea')) {
      return;
    }

    switch (event.key) {
      case 'j':
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'k':
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'x':
      case ' ':
        if (!selectable) break;
        event.preventDefault();
        if (event.shiftKey && anchorRef.current !== null) {
          selectRange(anchorRef.current, index);
        } else {
          anchorRef.current = index;
          toggle(rowKey(row));
        }
        break;
      case 'a':
        if (!selectable || event.metaKey || event.ctrlKey) break;
        event.preventDefault();
        setSelection(new Set(rows.map(rowKey)));
        break;
      case 'Escape':
        if (!selectable) break;
        event.preventDefault();
        setSelection(new Set());
        break;
      case 'Enter':
        event.preventDefault();
        onRowActivate?.(row);
        if (rowHref) {
          const href = rowHref(row);
          const link = event.currentTarget.querySelector<HTMLAnchorElement>(`a[href="${href}"]`);
          if (link) link.click();
        }
        break;
      default:
        break;
    }
  }

  const allSelected =
    selectable && rows.length > 0 && rows.every((row) => selectedIds?.has(rowKey(row)));
  const someSelected =
    selectable && !allSelected && rows.some((row) => selectedIds?.has(rowKey(row)));

  if (rows.length === 0 && emptyState) {
    return <div className="ds-datatable__empty">{emptyState}</div>;
  }

  const columnCount = columns.length + (selectable ? 1 : 0);

  return (
    <div
      ref={scrollRef}
      className={cx(
        'ds-datatable',
        `ds-datatable--${density}`,
        virtualized && 'ds-datatable--virtual',
        className,
      )}
      style={virtualized ? { maxHeight: viewportHeight } : undefined}
      onScroll={
        virtualized
          ? (event) => setScrollTop((event.target as HTMLDivElement).scrollTop)
          : undefined
      }
    >
      <table className="ds-datatable__table">
        <caption className="ds-datatable__caption">
          {caption}
          {virtualized ? ` — ${rows.length.toLocaleString()} rows, scrolled in a window` : ''}
        </caption>
        <thead className="ds-datatable__head">
          <tr>
            {selectable ? (
              <th scope="col" className="ds-datatable__select-cell">
                <input
                  type="checkbox"
                  aria-label={allSelected ? 'Clear selection' : 'Select all rows on this page'}
                  checked={allSelected}
                  ref={(node) => {
                    // Mixed state is the honest signal when a page is partly selected.
                    if (node) node.indeterminate = Boolean(someSelected);
                  }}
                  onChange={() => setSelection(allSelected ? new Set() : new Set(rows.map(rowKey)))}
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={cx(
                  column.align === 'end' && 'ds-datatable__cell--end',
                  column.secondary && 'ds-datatable__cell--secondary',
                )}
                aria-sort={
                  column.sortDirection
                    ? column.sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                {column.sortHref ? (
                  <a className="ds-datatable__sort" href={column.sortHref}>
                    {column.header}
                    <span aria-hidden="true" className="ds-datatable__sort-glyph">
                      {column.sortDirection === 'asc'
                        ? '↑'
                        : column.sortDirection === 'desc'
                          ? '↓'
                          : '↕'}
                    </span>
                  </a>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={bodyRef}>
          {/* Spacer rows stand in for the un-rendered ones so the scrollbar reflects the real
              row count. Without them the thumb would size itself to the window, not the table. */}
          {first > 0 ? (
            <tr aria-hidden="true" className="ds-datatable__spacer">
              <td colSpan={columnCount} style={{ height: first * rowHeight }} />
            </tr>
          ) : null}
          {visibleRows.map((row, offset) => {
            const index = first + offset;
            const id = rowKey(row);
            const isSelected = Boolean(selectedIds?.has(id));
            return (
              <tr
                key={id}
                data-row-index={index}
                // Roving tabindex: one stop for the whole table, then j/k inside it.
                tabIndex={index === cursor ? 0 : -1}
                aria-selected={selectable ? isSelected : undefined}
                className={cx(
                  'ds-datatable__row',
                  isSelected && 'ds-datatable__row--selected',
                  index === cursor && 'ds-datatable__row--cursor',
                )}
                onFocus={() => setCursor(index)}
                onKeyDown={(event) => handleKeyDown(event, index, row)}
              >
                {selectable ? (
                  <td className="ds-datatable__select-cell">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      aria-label={`Select ${id}`}
                      onChange={() => {
                        anchorRef.current = index;
                        toggle(id);
                      }}
                    />
                  </td>
                ) : null}
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cx(
                      column.align === 'end' && 'ds-datatable__cell--end',
                      column.secondary && 'ds-datatable__cell--secondary',
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
          {last < rows.length ? (
            <tr aria-hidden="true" className="ds-datatable__spacer">
              <td colSpan={columnCount} style={{ height: (rows.length - last) * rowHeight }} />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
