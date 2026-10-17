'use client';
/**
 * Audit events on the shared operator table. Read-only, so there is no selection: the value here
 * is sortable headers that are plain links, keyboard row navigation, and the secondary-column
 * collapse at narrow widths.
 */
import { DataTable, type DataTableColumn } from '@repo/ui';
import { formatWhen } from '../lib/format-when';
import type { AuditEventListItem } from './audit-store';

/** A 36-character account id is noise in a row; the full value stays in the tooltip. */
function shorten(id: string): string {
  return id.length > 14 ? `${id.slice(0, 8)}…` : id;
}

export function AuditTable({
  rows,
  sortHref,
  sortDirection,
  resetHref,
}: {
  readonly rows: readonly AuditEventListItem[];
  readonly sortHref: string;
  readonly sortDirection: 'asc' | 'desc';
  readonly resetHref: string;
}) {
  const columns: readonly DataTableColumn<AuditEventListItem>[] = [
    {
      id: 'when',
      header: 'When',
      sortHref,
      sortDirection,
      width: '10.5rem',
      cell: (row) => (
        <span className="ds-mono" style={{ whiteSpace: 'nowrap' }}>
          {formatWhen(row.occurredAt)}
        </span>
      ),
    },
    {
      id: 'action',
      header: 'Action',
      cell: (row) => (
        <>
          <span className="story-review__row-title">{row.action}</span>
          <p className="story-review__row-meta ds-mono">{row.category}</p>
        </>
      ),
    },
    {
      id: 'actor',
      header: 'Actor',
      cell: (row) => (
        <span className="ds-mono" title={row.actorId}>
          {row.actorDisplayName ?? shorten(row.actorId)}
          <br />
          <span className="story-review__row-meta">{row.actorType}</span>
        </span>
      ),
    },
    {
      id: 'subject',
      header: 'Subject',
      secondary: true,
      cell: (row) => (
        <span className="ds-mono">
          {row.subjectType}/{row.subjectId}
          {row.entityId ? (
            <>
              <br />
              entity:{row.entityId}
            </>
          ) : null}
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'Reason',
      cell: (row) => <span className="ds-sans">{row.reason}</span>,
    },
  ];
  return (
    <DataTable
      caption="Audit events with action, actor, subject, and operator reason"
      rows={rows}
      columns={columns}
      rowKey={(row) => row.id}
      virtualizeAbove={Infinity}
      emptyState={
        <p className="ds-sans">
          No audit events match this view. <a href={resetHref}>Clear filters</a>.
        </p>
      }
    />
  );
}
