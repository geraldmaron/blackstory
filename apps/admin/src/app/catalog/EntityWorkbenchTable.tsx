/**
 * Client island for the entity workbench: row selection and bulk decisions.
 *
 * Rows arrive as props already rendered by the server — this component never fetches the list.
 * The only client state is selection, which has no URL meaning, and the only network calls are
 * the two things that genuinely are mutations or selection escalation.
 */
'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, SelectionBar, type DataTableColumn } from '@repo/ui';
import { useAdminAuth } from '../../auth/AdminAuthProvider';
import type { CatalogDecisionAction } from '../../catalog/catalog-decisions-store';
import type { EntityRow, EntitySortKey } from '../../lib/entity-query';
import { BulkEditPanel } from './BulkEditPanel';
import { formatLivingStatusLabel } from './living-status-label';

const ACTION_LABEL: Record<CatalogDecisionAction, string> = {
  flag_for_retraction: 'Flag for retraction',
  needs_review: 'Needs review',
  clear_flag: 'Clear flag',
};

/**
 * Above this many entities a bulk decision asks for typed confirmation rather than a single
 * click. The old page instead refused outright past 50, which just meant large sets could not
 * be acted on at all.
 */
const CONFIRM_THRESHOLD = 250;

type Props = {
  readonly rows: readonly EntityRow[];
  readonly total: number;
  /** Serialized current query, replayed to resolve every matching id for select-all. */
  readonly searchQuery: string;
  readonly sortKey: EntitySortKey;
  readonly sortDirection: 'asc' | 'desc';
  readonly sortHrefs: Readonly<Record<'name' | 'kind' | 'claims' | 'updated', string>>;
  /**
   * Resolved on the server: the browser only knows someone is signed in, not which staff role
   * they hold. Hiding the affordance is presentation — `/catalog/merge` re-checks the role.
   */
  readonly canMerge: boolean;
  /** Same server-resolved role check, for bulk canonical field edits. */
  readonly canBulkEdit: boolean;
  /** Passed down rather than imported: the vocabulary lives in server-only `@repo/domain`. */
  readonly sensitivityClasses: readonly string[];
};

/**
 * A merge review URL carries ids explicitly rather than replaying the filter, because a merge is
 * about these specific records. Past this many, the URL stops being a reasonable carrier and the
 * selection is almost certainly wrong anyway.
 */
const MAX_MERGE_SELECTION = 26;

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso || '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function EntityWorkbenchTable({
  rows,
  total,
  searchQuery,
  sortKey,
  sortDirection,
  sortHrefs,
  canMerge,
  canBulkEdit,
  sensitivityClasses,
}: Props) {
  const router = useRouter();
  const { getIdToken } = useAdminAuth();
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [allMatchesSelected, setAllMatchesSelected] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setAllMatchesSelected(false);
  }, []);

  const selectAllMatches = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Sign in required');
      const response = await fetch(`/api/catalog/entity-ids?${searchQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as { ids?: string[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? `Select-all failed (${response.status})`);
      setSelectedIds(new Set(body.ids ?? []));
      setAllMatchesSelected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [getIdToken, searchQuery]);

  async function submitDecision(action: CatalogDecisionAction) {
    const entityIds = [...selectedIds];
    if (entityIds.length === 0) return;
    if (!reason.trim()) {
      setError('A reason is required — every bulk decision is audited.');
      return;
    }
    if (
      entityIds.length >= CONFIRM_THRESHOLD &&
      !window.confirm(
        `${ACTION_LABEL[action]} on ${entityIds.length.toLocaleString()} entities. This is recorded against every one of them. Continue?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getIdToken(true);
      if (!token) throw new Error('Sign in required');
      const response = await fetch('/api/catalog/bulk-decision', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, entityIds, reason: reason.trim() }),
      });
      const body = (await response.json()) as {
        error?: string;
        succeeded?: number;
        failed?: number;
      };
      if (!response.ok) throw new Error(body.error ?? `Bulk decision failed (${response.status})`);
      setNotice(
        `${ACTION_LABEL[action]}: ${body.succeeded ?? 0} recorded${
          body.failed ? `, ${body.failed} failed` : ''
        }.`,
      );
      clearSelection();
      setReason('');
      // Re-render the server component so decision state on the rows is current.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const columns: readonly DataTableColumn<EntityRow>[] = [
    {
      id: 'name',
      header: 'Entity',
      sortHref: sortHrefs.name,
      ...(sortKey === 'name' ? { sortDirection } : {}),
      cell: (row) => (
        <>
          <Link href={`/catalog/${row.id}`} className="story-review__row-title">
            {row.displayName}
          </Link>
          <p className="story-review__row-meta ds-mono">{row.id}</p>
          {row.aliases.length > 0 ? (
            <p className="story-review__row-meta">also {row.aliases.slice(0, 2).join(', ')}</p>
          ) : null}
        </>
      ),
    },
    {
      id: 'kind',
      header: 'Kind',
      sortHref: sortHrefs.kind,
      ...(sortKey === 'kind' ? { sortDirection } : {}),
      cell: (row) => <span className="ds-mono">{row.kind}</span>,
    },
    {
      id: 'living',
      header: 'Living',
      secondary: true,
      cell: (row) => formatLivingStatusLabel(row.livingStatus),
    },
    {
      id: 'sensitivity',
      header: 'Sensitivity',
      // Safety-relevant, so it gets a column of its own rather than living inside the detail page.
      cell: (row) =>
        row.sensitivity.length === 0 ? (
          <span aria-hidden="true">—</span>
        ) : (
          <span className="story-review__badge" title={row.sensitivity.map((s) => s.source ?? s.class).join(', ')}>
            {row.sensitivity.map((entry) => entry.class.replace(/_/g, ' ')).join(', ')}
          </span>
        ),
    },
    {
      id: 'claims',
      header: 'Claims',
      align: 'end',
      sortHref: sortHrefs.claims,
      ...(sortKey === 'claims' ? { sortDirection } : {}),
      cell: (row) => <span className="ds-mono">{row.claimCount}</span>,
    },
    {
      id: 'updated',
      header: 'Updated',
      align: 'end',
      secondary: true,
      sortHref: sortHrefs.updated,
      ...(sortKey === 'updated' ? { sortDirection } : {}),
      cell: (row) => <span className="ds-mono">{formatWhen(row.updatedAt)}</span>,
    },
  ];

  return (
    <>
      {error ? (
        <p className="story-review__alert" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="story-review__notice" role="status">
          {notice}
        </p>
      ) : null}

      <DataTable
        caption="Canonical entities with kind, living status, sensitivity, claim count, and last update"
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        selectedIds={selectedIds}
        onSelectionChange={(next) => {
          setSelectedIds(next);
          // Any manual change means the selection is no longer the whole match set.
          setAllMatchesSelected(false);
        }}
        rowHref={(row) => `/catalog/${row.id}`}
        emptyState={
          <p className="ds-sans">
            No entities match this filter. <a href="/catalog">Clear filters</a> to see all{' '}
            {total.toLocaleString()}.
          </p>
        }
      />

      <SelectionBar
        selectedCount={selectedIds.size}
        matchCount={total}
        allMatchesSelected={allMatchesSelected}
        onSelectAllMatches={() => void selectAllMatches()}
        onClear={clearSelection}
      >
        <label className="story-review__field">
          <span className="ds-visually-hidden">Reason (required, audited)</span>
          <input
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason (required, audited)"
          />
        </label>
        {canMerge && selectedIds.size >= 2 && selectedIds.size <= MAX_MERGE_SELECTION ? (
          <Link
            className="ds-selection-bar__escalate"
            href={`/catalog/merge?ids=${[...selectedIds].map(encodeURIComponent).join(',')}`}
          >
            Merge {selectedIds.size}…
          </Link>
        ) : null}
        {(Object.keys(ACTION_LABEL) as CatalogDecisionAction[]).map((action) => (
          <button
            key={action}
            type="button"
            className="ds-selection-bar__escalate"
            disabled={busy}
            onClick={() => void submitDecision(action)}
          >
            {ACTION_LABEL[action]}
          </button>
        ))}
      </SelectionBar>

      {canBulkEdit && selectedIds.size > 0 ? (
        <BulkEditPanel selectedIds={selectedIds} sensitivityClasses={sensitivityClasses} />
      ) : null}
    </>
  );
}
