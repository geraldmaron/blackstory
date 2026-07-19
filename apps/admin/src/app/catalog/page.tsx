/**
 * Canonical entity catalog browser — search, filter, link to entity detail pages, and record
 * bulk decisions (flag for retraction / needs review / clear) on published entities.
 * Auth is enforced by the catalog layout gate; APIs re-verify the ID token.
 *
 * Decisions recorded here never publish or mutate an entity directly — see
 * apps/admin/src/catalog/catalog-decisions-store.ts's module doc. Promotion/edits otherwise
 * stay in operator triage workflows, not here.
 */
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '../../auth/AdminAuthProvider';
import type { CatalogDecisionAction } from '../../catalog/catalog-decisions-store';
import type { CatalogEntityListItem } from '../../catalog/catalog-store';
import { formatLivingStatusLabel } from './living-status-label';

const CATALOG_BULK_LIMIT = 50;

const ACTION_LABEL: Record<CatalogDecisionAction, string> = {
  flag_for_retraction: 'Flag for retraction',
  needs_review: 'Needs review',
  clear_flag: 'Clear flag',
};

type CatalogRow = CatalogEntityListItem & {
  readonly decision?: { readonly action: CatalogDecisionAction; readonly reason: string };
};

type BulkResult = {
  readonly succeeded: number;
  readonly failed: number;
  readonly errors: readonly { readonly entityId: string; readonly error: string }[];
};

function formatWhen(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CatalogPage() {
  const { getIdToken, user } = useAdminAuth();
  const [rows, setRows] = useState<readonly CatalogRow[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setRows([]);
        return;
      }
      const params = new URLSearchParams({ limit: '100' });
      const trimmed = search.trim();
      if (trimmed) params.set('search', trimmed);
      const response = await fetch(`/api/catalog/entities?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as {
        items?: CatalogRow[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? `Load failed (${response.status})`);
      }
      setRows(body.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [getIdToken, search]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (row) =>
        row.displayName.toLowerCase().includes(needle) ||
        row.id.toLowerCase().includes(needle) ||
        row.kind.toLowerCase().includes(needle),
    );
  }, [rows, search]);

  const allVisibleSelected = visible.length > 0 && visible.every((row) => selectedIds.has(row.id));

  function toggleOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        const next = new Set(current);
        for (const row of visible) next.delete(row.id);
        return next;
      }
      const next = new Set(current);
      for (const row of visible) next.add(row.id);
      return next;
    });
  }

  async function submitDecision(action: CatalogDecisionAction) {
    const entityIds = [...selectedIds];
    if (entityIds.length === 0) return;
    if (!reason.trim()) {
      setError('A decision reason is required — every bulk action is audited.');
      return;
    }
    setBusy(true);
    setError(null);
    setBulkResult(null);
    try {
      const token = await getIdToken(true);
      if (!token) {
        setError('Sign in required');
        return;
      }
      const response = await fetch('/api/catalog/bulk-decision', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, entityIds, reason: reason.trim() }),
      });
      const body = (await response.json()) as {
        error?: string;
        succeeded?: number;
        failed?: number;
        errors?: BulkResult['errors'];
      };
      if (!response.ok) {
        throw new Error(body.error ?? `Bulk decision failed (${response.status})`);
      }
      setBulkResult({
        succeeded: body.succeeded ?? 0,
        failed: body.failed ?? 0,
        errors: body.errors ?? [],
      });
      setSelectedIds(new Set());
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="story-review ds-container ds-page" id="main">
      <header className="story-review__header">
        <div>
          <p className="ds-page__eyebrow">Canonical catalog</p>
          <h1 className="ds-page__title">Entities</h1>
          <p className="ds-page__lede">
            Browse canonical entities in Firestore with kind, living status, and update timestamps.
            Select entities to record a bulk decision — this never publishes or edits an entity
            directly; the next release build reads these decisions, and the existing signed-manifest
            privileged-apply flow is still what makes anything live.
          </p>
          <p className="story-review__notice">
            Pending research lives in <Link href="/inbox">Inbox</Link>
            {' · '}
            <Link href="/cases">All cases</Link>
          </p>
        </div>
        <button
          type="button"
          className="ds-button ds-button--secondary"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <section className="story-review__toolbar" aria-label="Search entities">
        <label className="story-review__field">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Display name, kind, id…"
          />
        </label>
      </section>

      {error ? (
        <p className="story-review__alert" role="alert">
          {error}
        </p>
      ) : null}

      {bulkResult ? (
        <p className="story-review__notice" role="status">
          Bulk decision recorded: {bulkResult.succeeded} succeeded
          {bulkResult.failed > 0 ? `, ${bulkResult.failed} failed` : ''}.
        </p>
      ) : null}

      {selectedIds.size > 0 ? (
        <section className="story-review__bulk" aria-label="Bulk catalog decision">
          <p>
            <strong>{selectedIds.size}</strong> selected
            {selectedIds.size > CATALOG_BULK_LIMIT ? ` (over limit of ${CATALOG_BULK_LIMIT})` : ''}
          </p>
          <label className="story-review__field">
            <span>Reason (required, audited)</span>
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why this bulk decision?"
            />
          </label>
          <div className="story-review__bulk-actions">
            <button
              type="button"
              className="ds-button ds-button--primary"
              disabled={busy || selectedIds.size > CATALOG_BULK_LIMIT}
              onClick={() => void submitDecision('flag_for_retraction')}
            >
              {ACTION_LABEL.flag_for_retraction}
            </button>
            <button
              type="button"
              className="ds-button ds-button--secondary"
              disabled={busy || selectedIds.size > CATALOG_BULK_LIMIT}
              onClick={() => void submitDecision('needs_review')}
            >
              {ACTION_LABEL.needs_review}
            </button>
            <button
              type="button"
              className="ds-button ds-button--secondary"
              disabled={busy || selectedIds.size > CATALOG_BULK_LIMIT}
              onClick={() => void submitDecision('clear_flag')}
            >
              {ACTION_LABEL.clear_flag}
            </button>
            <button
              type="button"
              className="ds-button ds-button--secondary"
              disabled={busy}
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </button>
          </div>
        </section>
      ) : null}

      <section className="story-review__queue" aria-label="Entity list">
        {loading && rows.length === 0 ? (
          <p className="ds-mono">Loading entities…</p>
        ) : visible.length === 0 ? (
          <p className="ds-sans">
            {rows.length === 0 ? (
              <>
                No canonical entities found in this project. New material enters through{' '}
                <Link href="/inbox">Inbox</Link> triage before it lands here.
              </>
            ) : (
              'No entities match the current search.'
            )}
          </p>
        ) : (
          <div className="story-review__table-wrap">
            <table className="story-review__table">
              <caption className="ds-visually-hidden">
                Canonical entities with kind, living status, decision, and last update
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Select all visible entities"
                    />
                  </th>
                  <th scope="col">Display name</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Living</th>
                  <th scope="col">Decision</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        aria-label={`Select ${row.displayName}`}
                      />
                    </td>
                    <td>
                      <Link href={`/catalog/${row.id}`} className="story-review__row-title">
                        {row.displayName}
                      </Link>
                      <p className="story-review__row-meta ds-mono">{row.id}</p>
                    </td>
                    <td className="ds-mono">{row.kind}</td>
                    <td>{formatLivingStatusLabel(row.livingStatus)}</td>
                    <td>
                      {row.decision ? (
                        <span
                          className={`story-review__badge story-review__badge--${row.decision.action}`}
                          title={row.decision.reason}
                        >
                          {ACTION_LABEL[row.decision.action]}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="ds-mono">{formatWhen(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="story-review__queue-foot ds-mono">
              Showing {visible.length} of {rows.length}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
