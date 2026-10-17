'use client';
/** Graylist entries on the shared operator table; sortable headers are plain links. */
import { DataTable, type DataTableColumn } from '@repo/ui';
import { formatWhen } from '../lib/format-when';
import {
  formatGraylistDisposition,
  formatGraylistStatus,
} from '../../app/admin/graylist/graylist-labels';
import type { GraylistSortKey } from './graylist-query';
import type { GraylistListItem } from './graylist-store';

export function GraylistTable({
  rows,
  sortKey,
  sortDirection,
  sortHrefs,
  resetHref,
}: {
  readonly rows: readonly GraylistListItem[];
  readonly sortKey: GraylistSortKey;
  readonly sortDirection: 'asc' | 'desc';
  readonly sortHrefs: Readonly<Record<GraylistSortKey, string>>;
  readonly resetHref: string;
}) {
  const sorted = (key: GraylistSortKey) => ({
    sortHref: sortHrefs[key],
    ...(sortKey === key ? { sortDirection } : {}),
  });
  const columns: readonly DataTableColumn<GraylistListItem>[] = [
    {
      id: 'candidate',
      header: 'Candidate',
      cell: (row) => (
        <>
          <span className="story-review__row-title">{row.candidateId}</span>
          <p className="story-review__row-meta ds-mono">
            {row.id}
            {row.adapterId ? ` · ${row.adapterId}` : ''}
          </p>
          <p className="ds-sans">{row.reason}</p>
        </>
      ),
    },
    {
      id: 'disposition',
      header: 'Disposition',
      secondary: true,
      cell: (row) => formatGraylistDisposition(row.disposition),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <span className={`story-review__badge story-review__badge--${row.status}`}>
          {formatGraylistStatus(row.status)}
        </span>
      ),
    },
    {
      id: 'score',
      header: 'Score',
      align: 'end',
      ...sorted('score'),
      cell: (row) => <span className="ds-mono">{row.compositeScore.toFixed(2)}</span>,
    },
    {
      id: 'parked',
      header: 'Parked',
      align: 'end',
      ...sorted('parked'),
      width: '10.5rem',
      cell: (row) => (
        <span className="ds-mono" style={{ whiteSpace: 'nowrap' }}>
          {formatWhen(row.parkedAt)}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      caption="Graylist candidates with disposition, status, score, and parked time"
      rows={rows}
      columns={columns}
      rowKey={(row) => row.id}
      virtualizeAbove={Infinity}
      emptyState={
        <p className="ds-sans">
          No graylist entries match this view. <a href={resetHref}>Show the parked queue</a>.
        </p>
      }
    />
  );
}
