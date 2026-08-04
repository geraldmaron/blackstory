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
  readonly className?: string;
};

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
  className,
}: DataTableProps<Row>) {
  const selectable = Boolean(selectedIds && onSelectionChange);
  const [cursor, setCursor] = useState(0);
  // Anchor for shift+x range selection, mirroring how file lists behave.
  const anchorRef = useRef<number | null>(null);
  const bodyRef = useRef<HTMLTableSectionElement | null>(null);

  // A filter or page change swaps the row set underneath the cursor; parking it at the top is
  // the only position guaranteed to still exist.
  useEffect(() => {
    setCursor(0);
    anchorRef.current = null;
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

  const focusRow = useCallback((index: number) => {
    const element = bodyRef.current?.querySelectorAll<HTMLTableRowElement>('tr')[index];
    element?.focus();
  }, []);

  const move = useCallback(
    (delta: number) => {
      setCursor((current) => {
        const next = Math.min(Math.max(0, current + delta), Math.max(0, rows.length - 1));
        focusRow(next);
        return next;
      });
    },
    [rows.length, focusRow],
  );

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

  return (
    <div className={cx('ds-datatable', `ds-datatable--${density}`, className)}>
      <table className="ds-datatable__table">
        <caption className="ds-datatable__caption">{caption}</caption>
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
                  onChange={() =>
                    setSelection(allSelected ? new Set() : new Set(rows.map(rowKey)))
                  }
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
          {rows.map((row, index) => {
            const id = rowKey(row);
            const isSelected = Boolean(selectedIds?.has(id));
            return (
              <tr
                key={id}
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
        </tbody>
      </table>
    </div>
  );
}
