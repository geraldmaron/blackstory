/**
 * Publication release browser — manifests plus the active public release pointer.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../auth/AdminAuthProvider';
import type {
  ActiveReleasePointer,
  PublicationReleaseListItem,
} from '../../releases/releases-store';

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

export default function ReleasesPage() {
  const { getIdToken, user } = useAdminAuth();
  const [rows, setRows] = useState<readonly PublicationReleaseListItem[]>([]);
  const [activeRelease, setActiveRelease] = useState<ActiveReleasePointer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setRows([]);
        setActiveRelease(null);
        return;
      }
      const response = await fetch('/api/releases?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as {
        items?: PublicationReleaseListItem[];
        activeRelease?: ActiveReleasePointer | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? `Load failed (${response.status})`);
      }
      setRows(body.items ?? []);
      setActiveRelease(body.activeRelease ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function stage(mode: 'activate' | 'rollback') {
    if (!selectedId || !reason.trim()) {
      setError('Select a release and provide a durable operator reason');
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const token = await getIdToken(true);
      if (!token) {
        setError('Sign in required');
        return;
      }
      const response = await fetch('/api/releases/stage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          releaseId: selectedId,
          mode,
          reason: reason.trim(),
        }),
      });
      const body = (await response.json()) as { error?: string; note?: string };
      if (!response.ok) throw new Error(body.error ?? `Stage failed (${response.status})`);
      setStatus(body.note ?? 'Staged for review — public pointer unchanged');
      setReason('');
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
          <p className="ds-page__eyebrow">Publication</p>
          <h1 className="ds-page__title">Releases</h1>
          <p className="ds-page__lede">
            Signed release manifests and the current <span className="ds-mono">activeRelease</span>{' '}
            pointer. Activation is privileged — stage with a reason first; this desk never edits
            public projections in place.
          </p>
        </div>
        <button
          type="button"
          className="ds-button ds-button--secondary"
          onClick={() => void load()}
          disabled={loading || busy}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {activeRelease ? (
        <section className="story-review__notice" aria-label="Active release">
          <p className="ds-sans">
            Active release{' '}
            <span className="ds-mono">{activeRelease.releaseId}</span> · activated{' '}
            {formatWhen(activeRelease.activatedAt)} · index{' '}
            <span className="ds-mono">{activeRelease.searchIndexVersion}</span>
          </p>
        </section>
      ) : (
        <p className="story-review__notice" role="status">
          No active release pointer found in <span className="ds-mono">publicMeta/activeRelease</span>.
        </p>
      )}

      {error ? (
        <p className="story-review__alert" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="story-review__notice" role="status">
          {status}
        </p>
      ) : null}

      <section className="story-review__bulk" aria-label="Stage release action">
        <label className="story-review__field">
          <span>Selected release</span>
          <input
            type="text"
            value={selectedId ?? ''}
            onChange={(event) => setSelectedId(event.target.value || null)}
            placeholder="Click a row or paste release id"
          />
        </label>
        <label className="story-review__field">
          <span>Operator reason (required)</span>
          <input
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why activate or roll back"
          />
        </label>
        <div className="story-review__bulk-actions">
          <button
            type="button"
            className="ds-button ds-button--primary"
            disabled={busy}
            onClick={() => void stage('activate')}
          >
            Stage activate
          </button>
          <button
            type="button"
            className="ds-button ds-button--secondary"
            disabled={busy}
            onClick={() => void stage('rollback')}
          >
            Stage rollback
          </button>
        </div>
      </section>

      <section className="story-review__queue" aria-label="Publication releases">
        {loading && rows.length === 0 ? (
          <p className="ds-mono">Loading releases…</p>
        ) : rows.length === 0 ? (
          <p className="ds-sans">No publication releases found.</p>
        ) : (
          <div className="story-review__table-wrap">
            <table className="story-review__table">
              <thead>
                <tr>
                  <th scope="col">Release</th>
                  <th scope="col">Status</th>
                  <th scope="col">Search index</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isActive = activeRelease?.releaseId === row.id;
                  const isSelected = selectedId === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={isSelected || isActive ? 'is-selected' : undefined}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td>
                        <span className="story-review__row-title">{row.id}</span>
                        <p className="story-review__row-meta ds-mono">
                          by {row.createdBy}
                          {isActive ? ' · active pointer' : ''}
                        </p>
                      </td>
                      <td>
                        <span
                          className={`story-review__badge story-review__badge--${row.status}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="ds-mono">{row.searchIndexVersion}</td>
                      <td className="ds-mono">{formatWhen(row.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="story-review__queue-foot ds-mono">{rows.length} releases</p>
          </div>
        )}
      </section>
    </main>
  );
}
