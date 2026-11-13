'use client';

/**
 * The publisher table: filter by kind with chips, sort by any column from its header, and read
 * the long tail a page at a time. Server-rendered with the default view, so it reads without
 * JavaScript; hydration adds the filter, sort and paging.
 */
import React, { useMemo, useState } from 'react';
import { Button, Chip } from '@repo/ui';
import {
  SOURCE_KIND_LABELS,
  SOURCE_KINDS,
  type SourceKind,
  type SourceRow,
} from './source-library';

void React;

type SortKey = 'key' | 'kind' | 'records';
type Sort = { readonly key: SortKey; readonly direction: 'ascending' | 'descending' };

const PAGE = 50;

const COLUMNS: readonly {
  readonly key: SortKey;
  readonly label: string;
  readonly first: Sort['direction'];
}[] = [
  { key: 'key', label: 'Publisher', first: 'ascending' },
  { key: 'kind', label: 'Kind', first: 'ascending' },
  { key: 'records', label: 'Records citing it', first: 'descending' },
];

function compare(a: SourceRow, b: SourceRow, sort: Sort): number {
  const sign = sort.direction === 'ascending' ? 1 : -1;
  if (sort.key === 'records') return sign * (a.records - b.records) || a.key.localeCompare(b.key);
  if (sort.key === 'kind') {
    return (
      sign * SOURCE_KIND_LABELS[a.kind].localeCompare(SOURCE_KIND_LABELS[b.kind]) ||
      b.records - a.records
    );
  }
  return sign * a.label.localeCompare(b.label);
}

function SortGlyph({ direction }: { readonly direction: Sort['direction'] | undefined }) {
  return (
    <svg className="ds-sources-table__sort" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d={
          direction === 'ascending'
            ? 'M3 7.5 6 4.5l3 3'
            : direction === 'descending'
              ? 'M3 4.5 6 7.5l3-3'
              : 'M3.5 4.5 6 2l2.5 2.5M3.5 7.5 6 10l2.5-2.5'
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SourcesTable({ rows }: { readonly rows: readonly SourceRow[] }) {
  const [kind, setKind] = useState<SourceKind | 'all'>('all');
  const [sort, setSort] = useState<Sort>({ key: 'records', direction: 'descending' });
  const [shown, setShown] = useState(PAGE);

  const kindCounts = useMemo(() => {
    const counts = new Map<SourceKind, number>();
    for (const row of rows) counts.set(row.kind, (counts.get(row.kind) ?? 0) + 1);
    return counts;
  }, [rows]);

  const visible = useMemo(
    () =>
      rows.filter((row) => kind === 'all' || row.kind === kind).sort((a, b) => compare(a, b, sort)),
    [rows, kind, sort],
  );
  const max = rows.reduce((top, row) => Math.max(top, row.records), 1);
  const page = visible.slice(0, shown);

  function chooseKind(next: SourceKind | 'all') {
    setKind(next);
    setShown(PAGE);
  }

  function sortBy(key: SortKey) {
    const column = COLUMNS.find((entry) => entry.key === key)!;
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
        : { key, direction: column.first },
    );
  }

  return (
    <div className="ds-sources-table">
      <div
        className="ds-sources-table__kinds"
        role="group"
        aria-label="Show publishers of one kind"
      >
        <Chip selected={kind === 'all'} onClick={() => chooseKind('all')}>
          All
        </Chip>
        {SOURCE_KINDS.filter((entry) => kindCounts.has(entry)).map((entry) => (
          <Chip key={entry} selected={kind === entry} onClick={() => chooseKind(entry)}>
            {SOURCE_KIND_LABELS[entry]} {kindCounts.get(entry)!.toLocaleString('en-US')}
          </Chip>
        ))}
      </div>

      <table className="ds-sources-table__table">
        <caption className="ds-visually-hidden" aria-live="polite">
          Publishers cited by published records, {page.length.toLocaleString('en-US')} of{' '}
          {visible.length.toLocaleString('en-US')} shown
          {kind === 'all' ? '' : ` of kind ${SOURCE_KIND_LABELS[kind]}`}, sorted by{' '}
          {COLUMNS.find((entry) => entry.key === sort.key)!.label.toLowerCase()}, {sort.direction}.
        </caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`ds-sources-table__th ds-sources-table__th--${column.key}`}
                aria-sort={sort.key === column.key ? sort.direction : 'none'}
              >
                <button type="button" onClick={() => sortBy(column.key)}>
                  {column.label}
                  <SortGlyph direction={sort.key === column.key ? sort.direction : undefined} />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {page.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="ds-sources-table__name">
                {row.href ? (
                  <a href={row.href} rel="noopener noreferrer">
                    {row.label}
                  </a>
                ) : (
                  row.label
                )}
                <span className="ds-sources-table__kind-inline">
                  {SOURCE_KIND_LABELS[row.kind]}
                </span>
              </th>
              <td className="ds-sources-table__kind">{SOURCE_KIND_LABELS[row.kind]}</td>
              <td>
                <span className="ds-sources-table__count">
                  <span className="ds-sources-table__n">{row.records.toLocaleString('en-US')}</span>
                  <span className="ds-sources-table__bar" aria-hidden="true">
                    <span style={{ width: `${Math.max(2, (row.records / max) * 100)}%` }} />
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* The total is the page dek's and each kind chip's; the foot only says how many more. */}
      {visible.length > shown ? (
        <div className="ds-sources-table__foot">
          <Button variant="secondary" onClick={() => setShown((count) => count + PAGE * 2)}>
            Show {Math.min(PAGE * 2, visible.length - shown).toLocaleString('en-US')} more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
