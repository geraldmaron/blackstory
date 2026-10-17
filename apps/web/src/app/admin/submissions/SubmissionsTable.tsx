'use client';
/** Submissions on the shared operator table; sortable headers are plain links. */
import { DataTable, type DataTableColumn } from '@repo/ui';
import { formatWhen } from '../../../admin/lib/format-when';
import type { SubmissionSortKey } from '../../../admin/lib/postgres-submissions';
import type { SubmissionListItem } from '../../../admin/lib/postgres-submissions';

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase());
}

export function SubmissionsTable({
  rows,
  basePath,
  sortKey,
  sortDirection,
  sortHrefs,
  emptyHint,
}: {
  readonly rows: readonly SubmissionListItem[];
  readonly basePath: string;
  readonly sortKey: SubmissionSortKey;
  readonly sortDirection: 'asc' | 'desc';
  readonly sortHrefs: Readonly<Record<SubmissionSortKey, string>>;
  readonly emptyHint: string;
}) {
  const sorted = (key: SubmissionSortKey) => ({
    sortHref: sortHrefs[key],
    ...(sortKey === key ? { sortDirection } : {}),
  });
  const columns: readonly DataTableColumn<SubmissionListItem>[] = [
    {
      id: 'submission',
      header: 'Submission',
      cell: (row) => (
        <>
          <a className="story-review__row-title" href={`${basePath}/${row.id}`}>
            {row.title}
          </a>
          <p className="story-review__row-meta ds-mono">
            {row.id}
            {row.sourceUrl ? ` · ${row.sourceUrl}` : ''}
          </p>
        </>
      ),
    },
    {
      id: 'kind',
      header: 'Kind',
      secondary: true,
      ...sorted('kind'),
      cell: (row) => (row.kind ? titleCase(row.kind) : 'Unspecified'),
    },
    {
      id: 'status',
      header: 'Status',
      ...sorted('status'),
      cell: (row) => <span className="story-review__badge">{titleCase(row.status)}</span>,
    },
    {
      id: 'created',
      header: 'Submitted',
      align: 'end',
      width: '10.5rem',
      ...sorted('created'),
      cell: (row) => (
        <span className="ds-mono" style={{ whiteSpace: 'nowrap' }}>
          {formatWhen(row.createdAt)}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      caption="Submissions with status, kind, source, and intake time"
      rows={rows}
      columns={columns}
      rowKey={(row) => row.id}
      rowHref={(row) => `${basePath}/${row.id}`}
      virtualizeAbove={Infinity}
      emptyState={<p className="ds-sans">No submissions match this view. {emptyHint}</p>}
    />
  );
}
