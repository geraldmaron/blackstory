/**
 * Story packet review queue — filter, sort, inspect, single + bulk decisions.
 * Auth is enforced by the stories layout gate; APIs re-verify the ID token.
 */
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StoryResearchPacket } from '@repo/domain';
import { useAdminAuth } from '../../../auth/AdminAuthProvider';
import {
  STORY_REVIEW_EMPTY_COPY,
  STORY_REVIEW_INTENT_COPY,
  STORY_REVIEW_STEPS,
  storyReviewActionHelp,
  storyReviewActionLabel,
  type StoryReviewAction,
} from '../../../stories/story-review-copy';
import {
  DEFAULT_STORY_REVIEW_QUERY,
  STORY_REVIEW_BULK_LIMIT,
  applyStoryReviewQueue,
  countStoryReviewQueue,
  type StoryPacketDecisionFilter,
  type StoryReviewQueueQuery,
  type StoryReviewSortDirection,
  type StoryReviewSortKey,
  type StoryReviewStatusFilter,
} from '../../../stories/story-review-queue';
import '../../../cases/case-queue.css';

type ReviewState = {
  readonly decision: string;
  readonly reviewedAt: string;
  readonly reviewedByEmail: string;
};

type PacketRow = {
  readonly submissionId: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly title: string;
  readonly decision: string;
  readonly topicId: string;
  readonly validationIssueCount: number;
  readonly review: ReviewState | null;
  readonly packet: StoryResearchPacket;
};

type BulkResult = {
  readonly succeeded: number;
  readonly failed: number;
  readonly seedHandoffs: readonly { submissionId: string; seedHandoff: unknown }[];
};

function reviewLabel(row: PacketRow): string {
  return row.review?.decision ?? 'pending';
}

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

export default function StoryReviewPage() {
  const { getIdToken, user } = useAdminAuth();
  const [rows, setRows] = useState<readonly PacketRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState<StoryReviewQueueQuery>(DEFAULT_STORY_REVIEW_QUERY);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [seedHandoff, setSeedHandoff] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setRows([]);
        return;
      }
      const response = await fetch('/api/stories/packets?limit=200', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as { items?: PacketRow[]; error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? `Load failed (${response.status})`);
      }
      setRows(body.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const counts = useMemo(() => countStoryReviewQueue(rows), [rows]);
  const visible = useMemo(() => applyStoryReviewQueue(rows, query), [rows, query]);
  const selected = rows.find((row) => row.submissionId === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && !visible.some((row) => row.submissionId === selectedId)) {
      setSelectedId(visible[0]?.submissionId ?? null);
    }
  }, [visible, selectedId]);

  const allVisibleSelected =
    visible.length > 0 && visible.every((row) => selectedIds.has(row.submissionId));

  function patchQuery(partial: Partial<StoryReviewQueueQuery>) {
    setQuery((current) => ({ ...current, ...partial }));
  }

  function toggleOne(submissionId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(submissionId)) next.delete(submissionId);
      else next.add(submissionId);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        const next = new Set(current);
        for (const row of visible) next.delete(row.submissionId);
        return next;
      }
      const next = new Set(current);
      for (const row of visible) next.add(row.submissionId);
      return next;
    });
  }

  async function submitReview(
    decision: 'approved' | 'rejected' | 'needs_evidence',
    submissionIds: readonly string[],
  ) {
    if (submissionIds.length === 0) return;
    setBusy(true);
    setError(null);
    setSeedHandoff(null);
    setBulkResult(null);
    try {
      const token = await getIdToken(true);
      if (!token) {
        setError('Sign in required');
        return;
      }

      if (submissionIds.length === 1) {
        const response = await fetch(`/api/stories/packets/${submissionIds[0]}/review`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            decision,
            ...(note.trim() ? { note: note.trim() } : {}),
          }),
        });
        const body = (await response.json()) as {
          error?: string;
          seedHandoff?: unknown;
        };
        if (!response.ok) {
          throw new Error(body.error ?? `Review failed (${response.status})`);
        }
        if (body.seedHandoff) {
          setSeedHandoff(JSON.stringify(body.seedHandoff, null, 2));
        }
      } else {
        const response = await fetch('/api/stories/packets/review-bulk', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            decision,
            submissionIds,
            ...(note.trim() ? { note: note.trim() } : {}),
          }),
        });
        const body = (await response.json()) as {
          error?: string;
          succeeded?: number;
          failed?: number;
          seedHandoffs?: BulkResult['seedHandoffs'];
        };
        if (!response.ok) {
          throw new Error(body.error ?? `Bulk review failed (${response.status})`);
        }
        setBulkResult({
          succeeded: body.succeeded ?? 0,
          failed: body.failed ?? 0,
          seedHandoffs: body.seedHandoffs ?? [],
        });
        if ((body.seedHandoffs?.length ?? 0) === 1 && body.seedHandoffs?.[0]?.seedHandoff) {
          setSeedHandoff(JSON.stringify(body.seedHandoffs[0].seedHandoff, null, 2));
        }
      }

      setSelectedIds(new Set());
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const bulkTargets = [...selectedIds];

  return (
    <main className="story-review ds-container ds-page" id="main">
      <header className="story-review__header">
        <div>
          <p className="ds-page__eyebrow">From quarantine</p>
          <h1 className="ds-page__title">Story review</h1>
          <p className="ds-page__lede">{STORY_REVIEW_INTENT_COPY}</p>
          <ol className="acq__steps" aria-label="How to review a story packet">
            {STORY_REVIEW_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
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

      <section className="story-review__stats" aria-label="Queue counts">
        <button
          type="button"
          className={query.reviewStatus === 'pending' ? 'is-active' : undefined}
          onClick={() => patchQuery({ reviewStatus: 'pending' })}
        >
          Pending <strong>{counts.pending}</strong>
        </button>
        <button
          type="button"
          className={query.reviewStatus === 'all' ? 'is-active' : undefined}
          onClick={() => patchQuery({ reviewStatus: 'all' })}
        >
          All <strong>{counts.total}</strong>
        </button>
        <button
          type="button"
          className={query.reviewStatus === 'approved' ? 'is-active' : undefined}
          onClick={() => patchQuery({ reviewStatus: 'approved' })}
        >
          Approved <strong>{counts.approved}</strong>
        </button>
        <button
          type="button"
          className={query.reviewStatus === 'needs_evidence' ? 'is-active' : undefined}
          onClick={() => patchQuery({ reviewStatus: 'needs_evidence' })}
        >
          Needs evidence <strong>{counts.needsEvidence}</strong>
        </button>
        <button
          type="button"
          className={query.reviewStatus === 'rejected' ? 'is-active' : undefined}
          onClick={() => patchQuery({ reviewStatus: 'rejected' })}
        >
          Rejected <strong>{counts.rejected}</strong>
        </button>
        <button
          type="button"
          className={query.issuesOnly ? 'is-active' : undefined}
          onClick={() => patchQuery({ issuesOnly: !query.issuesOnly })}
        >
          With issues <strong>{counts.withIssues}</strong>
        </button>
      </section>

      <section className="story-review__toolbar" aria-label="Filter and sort">
        <label className="story-review__field">
          <span>Search</span>
          <input
            type="search"
            value={query.search}
            onChange={(event) => patchQuery({ search: event.target.value })}
            placeholder="Title, place, topic, id…"
          />
        </label>
        <label className="story-review__field">
          <span>Review status</span>
          <select
            value={query.reviewStatus}
            onChange={(event) =>
              patchQuery({ reviewStatus: event.target.value as StoryReviewStatusFilter })
            }
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="needs_evidence">Needs evidence</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="story-review__field">
          <span>Packet decision</span>
          <select
            value={query.packetDecision}
            onChange={(event) =>
              patchQuery({ packetDecision: event.target.value as StoryPacketDecisionFilter })
            }
          >
            <option value="all">All</option>
            <option value="recommend">Recommend</option>
            <option value="needs_evidence">Needs evidence</option>
            <option value="reject">Reject</option>
          </select>
        </label>
        <label className="story-review__field">
          <span>Sort</span>
          <select
            value={query.sortKey}
            onChange={(event) => patchQuery({ sortKey: event.target.value as StoryReviewSortKey })}
          >
            <option value="createdAt">Created</option>
            <option value="title">Title</option>
            <option value="packetDecision">Packet decision</option>
            <option value="issueCount">Issue count</option>
            <option value="reviewStatus">Review status</option>
          </select>
        </label>
        <label className="story-review__field">
          <span>Direction</span>
          <select
            value={query.sortDirection}
            onChange={(event) =>
              patchQuery({ sortDirection: event.target.value as StoryReviewSortDirection })
            }
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </section>

      {error ? (
        <p className="story-review__alert" role="alert">
          {error}
        </p>
      ) : null}

      {bulkResult ? (
        <p className="story-review__notice" role="status">
          Bulk review finished: {bulkResult.succeeded} succeeded
          {bulkResult.failed > 0 ? `, ${bulkResult.failed} failed` : ''}.
          {bulkResult.seedHandoffs.length > 0
            ? ` ${bulkResult.seedHandoffs.length} seed handoff(s) ready below.`
            : ''}
        </p>
      ) : null}

      {selectedIds.size > 0 ? (
        <section className="story-review__bulk" aria-label="Bulk actions">
          <p>
            <strong>{selectedIds.size}</strong> selected
            {selectedIds.size > STORY_REVIEW_BULK_LIMIT
              ? ` (over limit of ${STORY_REVIEW_BULK_LIMIT})`
              : ''}
          </p>
          <div className="story-review__bulk-actions">
            <button
              type="button"
              className="ds-button ds-button--primary"
              disabled={busy || selectedIds.size > STORY_REVIEW_BULK_LIMIT}
              title={storyReviewActionHelp('approved')}
              onClick={() => void submitReview('approved', bulkTargets)}
            >
              Approve selected
            </button>
            <button
              type="button"
              className="ds-button ds-button--secondary"
              disabled={busy || selectedIds.size > STORY_REVIEW_BULK_LIMIT}
              title={storyReviewActionHelp('needs_evidence')}
              onClick={() => void submitReview('needs_evidence', bulkTargets)}
            >
              Needs evidence
            </button>
            <button
              type="button"
              className="ds-button ds-button--secondary"
              disabled={busy || selectedIds.size > STORY_REVIEW_BULK_LIMIT}
              title={storyReviewActionHelp('rejected')}
              onClick={() => void submitReview('rejected', bulkTargets)}
            >
              Reject selected
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

      <div className="story-review__layout">
        <section className="story-review__queue" aria-label="Story packet queue">
          {loading && rows.length === 0 ? (
            <p className="ds-mono">Loading packets…</p>
          ) : visible.length === 0 ? (
            <div className="ds-sans">
              <p>
                {rows.length === 0
                  ? STORY_REVIEW_EMPTY_COPY.noPackets
                  : STORY_REVIEW_EMPTY_COPY.noMatch}
              </p>
              {rows.length === 0 ? (
                <p className="acq-sheet__meta ds-mono">{STORY_REVIEW_EMPTY_COPY.cliHint}</p>
              ) : null}
            </div>
          ) : (
            <div className="story-review__table-wrap">
              <table className="story-review__table">
                <thead>
                  <tr>
                    <th scope="col">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label="Select all visible packets"
                      />
                    </th>
                    <th scope="col">Title</th>
                    <th scope="col">Review</th>
                    <th scope="col">Packet</th>
                    <th scope="col">Issues</th>
                    <th scope="col">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const isSelected = selectedId === row.submissionId;
                    return (
                      <tr
                        key={row.submissionId}
                        className={isSelected ? 'is-selected' : undefined}
                        onClick={() => setSelectedId(row.submissionId)}
                      >
                        <td onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.submissionId)}
                            onChange={() => toggleOne(row.submissionId)}
                            aria-label={`Select ${row.title}`}
                          />
                        </td>
                        <td>
                          <button type="button" className="story-review__row-title">
                            {row.title}
                          </button>
                          <p className="story-review__row-meta ds-mono">{row.submissionId}</p>
                        </td>
                        <td>
                          <span
                            className={`story-review__badge story-review__badge--${reviewLabel(row)}`}
                          >
                            {reviewLabel(row)}
                          </span>
                        </td>
                        <td className="ds-mono">{row.decision}</td>
                        <td className="ds-mono">{row.validationIssueCount}</td>
                        <td className="ds-mono">{formatWhen(row.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="story-review__queue-foot ds-mono">
                Showing {visible.length} of {rows.length}
              </p>
            </div>
          )}
        </section>

        <section className="story-review__detail" aria-label="Selected packet">
          {!selected ? (
            <p className="ds-sans">
              Select a story packet from the queue to read cites and decide.
            </p>
          ) : (
            <>
              <p className="story-review__detail-meta ds-mono">
                {reviewLabel(selected)} · proposal {selected.decision} ·{' '}
                {selected.packet.draft.eraLabel} · {selected.packet.draft.placeLabel}
              </p>
              <h2 className="ds-section__title">{selected.packet.draft.title}</h2>
              <p className="ds-page__lede">{selected.packet.draft.dek}</p>
              <p className="ds-sans">
                Confidence {(selected.packet.confidence * 100).toFixed(0)}% · topic{' '}
                <span className="ds-mono">{selected.topicId}</span>
              </p>
              <p className="ds-sans">{selected.packet.rationale}</p>

              {selected.packet.validationIssues.length > 0 ? (
                <div className="story-review__issues">
                  <h3 className="ds-section__title">Validation issues</h3>
                  <ul>
                    {selected.packet.validationIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <h3 className="ds-section__title">Research brief</h3>
              <dl className="story-review__brief">
                <div>
                  <dt>Thesis</dt>
                  <dd>{selected.packet.brief.thesisQuestion}</dd>
                </div>
                <div>
                  <dt>Conventional start</dt>
                  <dd>{selected.packet.brief.conventionalStartLine}</dd>
                </div>
                <div>
                  <dt>Relocated start</dt>
                  <dd>{selected.packet.brief.relocatedStartLine}</dd>
                </div>
                {selected.packet.brief.mechanismLayers.length > 0 ? (
                  <div>
                    <dt>Mechanisms</dt>
                    <dd>
                      <ul>
                        {selected.packet.brief.mechanismLayers.map((layer) => (
                          <li key={`${layer.kind}-${layer.summary.slice(0, 24)}`}>
                            <span className="ds-mono">{layer.kind}</span> — {layer.summary}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ) : null}
              </dl>

              {selected.packet.anchors.length > 0 ? (
                <>
                  <h3 className="ds-section__title">Anchors</h3>
                  <ul className="story-review__anchors">
                    {selected.packet.anchors.map((anchor) => (
                      <li key={anchor.id}>
                        <strong>{anchor.who ?? anchor.instrument ?? anchor.id}</strong>
                        {` — ${anchor.role}`}
                        {anchor.whereLabel ? ` · ${anchor.whereLabel}` : ''}
                        {anchor.whenLabel ? ` · ${anchor.whenLabel}` : ''}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <h3 className="ds-section__title">Draft</h3>
              <div className="ds-prose">
                {selected.packet.draft.body.map((section, index) => (
                  <section key={section.heading ?? `s-${index}`}>
                    {section.heading ? <h4>{section.heading}</h4> : null}
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                    ))}
                  </section>
                ))}
              </div>

              <h3 className="ds-section__title">Cite map</h3>
              <ul className="story-review__cites ds-mono">
                {selected.packet.citeMap.map((entry) => (
                  <li key={entry.sentenceId}>
                    {entry.sentenceId}: {entry.citeKind}
                    {entry.citeId ? ` → ${entry.citeId}` : ''}
                  </li>
                ))}
              </ul>

              <label className="story-review__field story-review__note">
                <span>Decision note (optional)</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Example: Strong cite map; approve for seed handoff after one more primary source"
                />
              </label>

              <div className="acq-sheet__decide">
                <h3 className="acq-sheet__decide-title">Decide</h3>
                <p className="acq-sheet__decide-lede">
                  Approval records your review and may return a seed handoff — it does not publish.
                  For missing sources, <Link href="/evidence">attach evidence</Link> before
                  re-running story research.
                </p>
                <ul className="acq-sheet__action-help">
                  {(
                    [
                      'approved',
                      'needs_evidence',
                      'rejected',
                    ] as const satisfies readonly StoryReviewAction[]
                  ).map((action) => (
                    <li key={action}>
                      <strong>{storyReviewActionLabel(action)}.</strong>{' '}
                      {storyReviewActionHelp(action)}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="story-review__actions">
                <button
                  type="button"
                  className="ds-button ds-button--primary"
                  disabled={busy}
                  title={storyReviewActionHelp('approved')}
                  onClick={() => void submitReview('approved', [selected.submissionId])}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="ds-button ds-button--secondary"
                  disabled={busy}
                  title={storyReviewActionHelp('needs_evidence')}
                  onClick={() => void submitReview('needs_evidence', [selected.submissionId])}
                >
                  Needs evidence
                </button>
                <button
                  type="button"
                  className="ds-button ds-button--secondary"
                  disabled={busy}
                  title={storyReviewActionHelp('rejected')}
                  onClick={() => void submitReview('rejected', [selected.submissionId])}
                >
                  Reject
                </button>
              </div>

              {seedHandoff ? (
                <div className="story-review__handoff">
                  <h3 className="ds-section__title">Approved artifact</h3>
                  <p className="ds-sans">
                    Approval does not publish. This validated JSON remains available for release
                    assembly; activation still requires the Releases desk and an independent actor.
                  </p>
                  <pre className="ds-mono">{seedHandoff}</pre>
                </div>
              ) : null}

              {bulkResult && bulkResult.seedHandoffs.length > 1 ? (
                <div className="story-review__handoff">
                  <h3 className="ds-section__title">Bulk approved artifacts</h3>
                  <pre className="ds-mono">{JSON.stringify(bulkResult.seedHandoffs, null, 2)}</pre>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
