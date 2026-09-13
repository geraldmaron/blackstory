/**
 * The interactive half of /admin/releases: row selection, the decision reason, and the two stage
 * verbs.
 *
 * Split out of the route (repo-gyq6.9) when the page became a server component. The list is read
 * in the request and arrives as props; this component never fetches it. What stays client-side is
 * only what genuinely needs a browser: which row the operator has selected, the reason they are
 * typing, and the POST to `/admin/api/releases/stage` — a real mutation, which is exactly the case
 * the bead says the /api routes should keep serving.
 *
 * Staging records intent for review. It does not move the public pointer, and nothing here does:
 * privileged apply with signed-manifest verification is a separate path. `router.refresh()` after
 * a successful stage re-runs the server read so the table reflects the new manifest state rather
 * than the state the page was built with.
 */
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAdminAuth } from '../../../admin/auth/AdminAuthProvider';
import type {
  ActiveReleasePointer,
  PublicationReleaseListItem,
} from '../../../admin/releases/releases-store';

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

export type ReleasesDeskProps = {
  readonly rows: readonly PublicationReleaseListItem[];
  readonly activeRelease: ActiveReleasePointer | null;
};

export function ReleasesDesk({ rows, activeRelease }: ReleasesDeskProps) {
  const { getIdToken } = useAdminAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  async function stage(mode: 'activate' | 'rollback') {
    if (!selectedId || !reason.trim()) {
      setError('Select a release and add a decision reason.');
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
      const response = await fetch('/admin/api/releases/stage', {
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
      // Re-read on the server: the manifest list the operator is looking at is now one decision old.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
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
          <span>Decision reason (required)</span>
          <input
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Example: Manifest digest verified against catalog diff"
            aria-describedby="release-stage-steps"
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
        {rows.length === 0 ? (
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
                        <span className={`story-review__badge story-review__badge--${row.status}`}>
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
    </>
  );
}
