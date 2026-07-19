/**
 * Canonical entity detail page — aliases, identifiers, locations, and claim count.
 * Auth is enforced by the catalog layout gate; APIs re-verify the ID token.
 */
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAdminAuth } from '../../../auth/AdminAuthProvider';
import type { CatalogEntityDetail } from '../../../catalog/catalog-store';
import { formatLivingStatusLabel } from '../living-status-label';

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

export default function CatalogEntityDetailPage() {
  const params = useParams<{ id: string }>();
  const entityId = params.id;
  const { getIdToken, user } = useAdminAuth();
  const [detail, setDetail] = useState<CatalogEntityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setDetail(null);
        return;
      }
      const response = await fetch(`/api/catalog/entities/${encodeURIComponent(entityId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as {
        item?: CatalogEntityDetail;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? `Load failed (${response.status})`);
      }
      setDetail(body.item ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [entityId, getIdToken]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  return (
    <main className="story-review ds-container ds-page" id="main">
      <header className="story-review__header">
        <div>
          <p className="ds-page__eyebrow">Canonical catalog</p>
          <h1 className="ds-page__title">{detail?.displayName ?? entityId}</h1>
          <p className="ds-page__lede">
            Read-only canonical record — identifiers, aliases, and stored locations already in the
            archive. Edits and promotion stay in research triage, not on this desk.
          </p>
          <p className="story-review__notice">
            <Link href="/catalog">← Back to catalog</Link>
            {' · '}
            <Link href="/inbox">Open inbox</Link>
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

      {error ? (
        <p className="story-review__alert" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !detail ? (
        <p className="ds-mono">Loading entity…</p>
      ) : !detail ? (
        <p className="ds-sans">
          Entity not found. Confirm the id in <Link href="/catalog">Catalog</Link> or check whether
          it is still pending in <Link href="/inbox">Inbox</Link>.
        </p>
      ) : (
        <section className="story-review__detail" aria-label="Entity detail">
          <p className="story-review__detail-meta ds-mono">
            {detail.kind} · updated {formatWhen(detail.updatedAt)}
            {detail.livingStatus ? ` · ${formatLivingStatusLabel(detail.livingStatus)}` : ''}
            {detail.claimCount !== undefined ? ` · ${detail.claimCount} claims` : ''}
          </p>

          {detail.sensitivity && detail.sensitivity.length > 0 ? (
            <p className="ds-sans">
              Sensitivity:{' '}
              <span className="ds-mono">{detail.sensitivity.join(', ')}</span>
            </p>
          ) : null}

          <h2 className="ds-section__title">Identifiers</h2>
          {detail.identifiers.length === 0 ? (
            <p className="ds-sans">No identifiers recorded.</p>
          ) : (
            <ul className="story-review__anchors">
              {detail.identifiers.map((identifier) => (
                <li key={`${identifier.system}:${identifier.value}`}>
                  <span className="ds-mono">{identifier.system}</span> — {identifier.value}
                  {identifier.note ? ` (${identifier.note})` : ''}
                </li>
              ))}
            </ul>
          )}

          <h2 className="ds-section__title">Aliases</h2>
          {detail.aliases.length === 0 ? (
            <p className="ds-sans">No aliases recorded.</p>
          ) : (
            <ul className="story-review__anchors">
              {detail.aliases.map((alias) => (
                <li key={`${alias.kind ?? 'alias'}:${alias.value}`}>
                  {alias.value}
                  {alias.kind ? (
                    <>
                      {' '}
                      · <span className="ds-mono">{alias.kind}</span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <h2 className="ds-section__title">Locations</h2>
          {detail.locations.length === 0 ? (
            <p className="ds-sans">No locations in subcollection.</p>
          ) : (
            <div className="story-review__table-wrap">
              <table className="story-review__table">
                <thead>
                  <tr>
                    <th scope="col">Label</th>
                    <th scope="col">Precision</th>
                    <th scope="col">Coordinates</th>
                    <th scope="col">Id</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.locations.map((location) => (
                    <tr key={location.id}>
                      <td>{location.label ?? '—'}</td>
                      <td className="ds-mono">{location.precision ?? '—'}</td>
                      <td className="ds-mono">
                        {location.lat !== undefined && location.lng !== undefined
                          ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                          : '—'}
                      </td>
                      <td className="ds-mono">{location.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
