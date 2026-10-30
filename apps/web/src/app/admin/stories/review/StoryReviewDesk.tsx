/**
 * Story packet review queue — filter, sort, inspect, single + bulk decisions.
 * Auth is enforced by the stories layout gate; APIs re-verify the ID token.
 *
 * The packet list is read on the server and arrives as `initialRows`; this component does not
 * fetch it on mount. Browser state covers filtering, sorting, selection, notes, and the single and
 * bulk decision POSTs.
 */
'use client';

import { FormButton, FormInput, FormSelect } from '../../../../admin/design-system/fields';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdminAuth } from '../../../../admin/auth/AdminAuthProvider';
import {
  STORY_REVIEW_EMPTY_COPY,
  STORY_REVIEW_INTENT_COPY,
  STORY_REVIEW_STEPS,
  storyReviewActionHelp,
} from '../../../../admin/stories/story-review-copy';
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
} from '../../../../admin/stories/story-review-queue';
import {
  StoryPacketDetail,
  formatWhen,
  reviewLabel,
  type PacketRow,
} from '../../../../admin/stories/StoryPacketDetail';
import { postStoryPacketReview } from '../../../../admin/stories/story-packet-review-client';
import { DeskTitleBar } from '../../../../admin/design-system/ui';
import '../../../../admin/cases/case-queue.css';

/** The header carries the first two sentences of the intent copy; the rest sits directly below. */
const INTENT_SENTENCES = STORY_REVIEW_INTENT_COPY.split(/(?<=\.)\s+/);
const INTENT_LEAD = INTENT_SENTENCES.slice(0, 2).join(' ');
const INTENT_REST = INTENT_SENTENCES.slice(2).join(' ');

export type { PacketRow };

type BulkResult = {
  readonly succeeded: number;
  readonly failed: number;
  readonly storyDrafts: readonly { submissionId: string; slug: string }[];
};

export type StoryReviewDeskProps = {
  readonly initialRows?: readonly PacketRow[];
};

export function StoryReviewDesk({ initialRows = [] }: StoryReviewDeskProps) {
  const { getIdToken, user } = useAdminAuth();
  const [rows, setRows] = useState<readonly PacketRow[]>(initialRows);
  /*
   * Whether the server already handed us this queue. Without this the mount would immediately
   * re-fetch what the page was just rendered with, which is the cost the conversion exists to
   * remove. A ref rather than state so it cannot re-arm on a re-render, and cleared on first run
   * so every later `load()` is a real refresh the reviewer asked for.
   */
  const servedFromServer = useRef(initialRows.length > 0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState<StoryReviewQueueQuery>(DEFAULT_STORY_REVIEW_QUERY);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [storySlug, setStorySlug] = useState<string | null>(null);
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
      const response = await fetch('/admin/api/stories/packets?limit=200', {
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
    if (servedFromServer.current) {
      servedFromServer.current = false;
      return;
    }
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
    setStorySlug(null);
    setBulkResult(null);
    try {
      const token = await getIdToken(true);
      if (!token) {
        setError('Sign in required');
        return;
      }

      if (submissionIds.length === 1) {
        const body = await postStoryPacketReview(token, submissionIds[0]!, decision, note);
        if (body.storyDraft) setStorySlug(body.storyDraft.slug);
      } else {
        const response = await fetch('/admin/api/stories/packets/review-bulk', {
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
          storyDrafts?: BulkResult['storyDrafts'];
        };
        if (!response.ok) {
          throw new Error(body.error ?? `Bulk review failed (${response.status})`);
        }
        setBulkResult({
          succeeded: body.succeeded ?? 0,
          failed: body.failed ?? 0,
          storyDrafts: body.storyDrafts ?? [],
        });
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
      <DeskTitleBar
        eyebrow="From quarantine"
        title="Story review"
        description={INTENT_LEAD}
        actions={
          <FormButton
            type="button"
            className="ds-button ds-button--secondary"
            onClick={() => void load()}
            disabled={loading || busy}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </FormButton>
        }
      />
      {INTENT_REST ? <p>{INTENT_REST}</p> : null}
      <ol className="acq__steps" aria-label="How to review a story packet">
        {STORY_REVIEW_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <section className="story-review__stats" aria-label="Queue counts">
        <FormButton
          type="button"
          className={query.reviewStatus === 'pending' ? 'is-active' : undefined}
          onClick={() => patchQuery({ reviewStatus: 'pending' })}
        >
          Pending <strong>{counts.pending}</strong>
        </FormButton>
        <FormButton
          type="button"
          className={query.reviewStatus === 'all' ? 'is-active' : undefined}
          onClick={() => patchQuery({ reviewStatus: 'all' })}
        >
          All <strong>{counts.total}</strong>
        </FormButton>
        <FormButton
          type="button"
          className={query.reviewStatus === 'approved' ? 'is-active' : undefined}
          onClick={() => patchQuery({ reviewStatus: 'approved' })}
        >
          Approved <strong>{counts.approved}</strong>
        </FormButton>
        <FormButton
          type="button"
          className={query.reviewStatus === 'needs_evidence' ? 'is-active' : undefined}
          onClick={() => patchQuery({ reviewStatus: 'needs_evidence' })}
        >
          Needs evidence <strong>{counts.needsEvidence}</strong>
        </FormButton>
        <FormButton
          type="button"
          className={query.reviewStatus === 'rejected' ? 'is-active' : undefined}
          onClick={() => patchQuery({ reviewStatus: 'rejected' })}
        >
          Rejected <strong>{counts.rejected}</strong>
        </FormButton>
        <FormButton
          type="button"
          className={query.issuesOnly ? 'is-active' : undefined}
          onClick={() => patchQuery({ issuesOnly: !query.issuesOnly })}
        >
          With issues <strong>{counts.withIssues}</strong>
        </FormButton>
      </section>

      <section className="story-review__toolbar" aria-label="Filter and sort">
        <label className="story-review__field">
          <span>Search</span>
          <FormInput
            type="search"
            value={query.search}
            onChange={(event) => patchQuery({ search: event.target.value })}
            placeholder="Title, place, topic, id…"
          />
        </label>
        <label className="story-review__field">
          <span>Review status</span>
          <FormSelect
            value={query.reviewStatus}
            onValueChange={(nextValue) =>
              patchQuery({ reviewStatus: nextValue as StoryReviewStatusFilter })
            }
            aria-label="Review status"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="needs_evidence">Needs evidence</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </FormSelect>
        </label>
        <label className="story-review__field">
          <span>Packet decision</span>
          <FormSelect
            value={query.packetDecision}
            onValueChange={(nextValue) =>
              patchQuery({ packetDecision: nextValue as StoryPacketDecisionFilter })
            }
            aria-label="Packet decision"
          >
            <option value="all">All</option>
            <option value="recommend">Recommend</option>
            <option value="needs_evidence">Needs evidence</option>
            <option value="reject">Reject</option>
          </FormSelect>
        </label>
        <label className="story-review__field">
          <span>Sort</span>
          <FormSelect
            value={query.sortKey}
            onValueChange={(nextValue) => patchQuery({ sortKey: nextValue as StoryReviewSortKey })}
            aria-label="Sort"
          >
            <option value="createdAt">Created</option>
            <option value="title">Title</option>
            <option value="packetDecision">Packet decision</option>
            <option value="issueCount">Issue count</option>
            <option value="reviewStatus">Review status</option>
          </FormSelect>
        </label>
        <label className="story-review__field">
          <span>Direction</span>
          <FormSelect
            value={query.sortDirection}
            onValueChange={(nextValue) =>
              patchQuery({ sortDirection: nextValue as StoryReviewSortDirection })
            }
            aria-label="Direction"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </FormSelect>
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
          {bulkResult.storyDrafts.length > 0
            ? ` ${bulkResult.storyDrafts.length} editable story draft(s) available.`
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
            <FormButton
              type="button"
              className="ds-button ds-button--primary"
              disabled={busy || selectedIds.size > STORY_REVIEW_BULK_LIMIT}
              title={storyReviewActionHelp('approved')}
              onClick={() => void submitReview('approved', bulkTargets)}
            >
              Approve selected
            </FormButton>
            <FormButton
              type="button"
              className="ds-button ds-button--secondary"
              disabled={busy || selectedIds.size > STORY_REVIEW_BULK_LIMIT}
              title={storyReviewActionHelp('needs_evidence')}
              onClick={() => void submitReview('needs_evidence', bulkTargets)}
            >
              Needs evidence
            </FormButton>
            <FormButton
              type="button"
              className="ds-button ds-button--secondary"
              disabled={busy || selectedIds.size > STORY_REVIEW_BULK_LIMIT}
              title={storyReviewActionHelp('rejected')}
              onClick={() => void submitReview('rejected', bulkTargets)}
            >
              Reject selected
            </FormButton>
            <FormButton
              type="button"
              className="ds-button ds-button--secondary"
              disabled={busy}
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </FormButton>
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
                      <FormInput
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
                          <FormInput
                            type="checkbox"
                            checked={selectedIds.has(row.submissionId)}
                            onChange={() => toggleOne(row.submissionId)}
                            aria-label={`Select ${row.title}`}
                          />
                        </td>
                        <td>
                          <FormButton type="button" className="story-review__row-title">
                            {row.title}
                          </FormButton>
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
              <p className="ds-sans">
                <Link href={`/admin/stories/review/${selected.submissionId}`}>
                  Open this packet on its own page
                </Link>
              </p>
              <StoryPacketDetail
                row={selected}
                note={note}
                onNoteChange={setNote}
                busy={busy}
                onDecide={submitReview}
                storySlug={storySlug}
                bulkDrafts={bulkResult?.storyDrafts ?? []}
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
