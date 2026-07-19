/**
 * Canonical entity catalog browser — search, filter, and link to entity detail pages.
 * Auth is enforced by the catalog layout gate; APIs re-verify the ID token.
 */
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '../../auth/AdminAuthProvider';
import type { CatalogEntityListItem } from '../../catalog/catalog-store';
import { formatLivingStatusLabel } from './living-status-label';

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
  const [rows, setRows] = useState<readonly CatalogEntityListItem[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        items?: CatalogEntityListItem[];
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

  return (
    <main className="story-review ds-container ds-page" id="main">
      <header className="story-review__header">
        <div>
          <p className="ds-page__eyebrow">Canonical catalog</p>
          <h1 className="ds-page__title">Entities</h1>
          <p className="ds-page__lede">
            Browse canonical entities in Firestore with kind, living status, and update timestamps.
            Read-only inspection — promotion and edits stay in operator triage workflows, not here.
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
                Canonical entities with kind, living status, and last update
              </caption>
              <thead>
                <tr>
                  <th scope="col">Display name</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Living</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/catalog/${row.id}`} className="story-review__row-title">
                        {row.displayName}
                      </Link>
                      <p className="story-review__row-meta ds-mono">{row.id}</p>
                    </td>
                    <td className="ds-mono">{row.kind}</td>
                    <td>{formatLivingStatusLabel(row.livingStatus)}</td>
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
