/**
 * Single-packet review for `/admin/stories/review/[submissionId]`.
 *
 * The server page reads the packet and hands it over as `row`; this component renders the same
 * detail and decision panel as the review desk and records one decision. After a decision it
 * refreshes the server data so the recorded review shows.
 */
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAdminAuth } from '../auth/AdminAuthProvider';
import { StoryPacketDetail, formatWhen, type PacketRow } from './StoryPacketDetail';
import { postStoryPacketReview } from './story-packet-review-client';
import type { StoryPacketReviewDecision } from './story-packet-review-decision';
import '../cases/case-queue.css';

export function StoryPacketReview({ row }: { readonly row: PacketRow }) {
  const { getIdToken } = useAdminAuth();
  const router = useRouter();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [storySlug, setStorySlug] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<StoryPacketReviewDecision | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(decision: StoryPacketReviewDecision) {
    setBusy(true);
    setError(null);
    setStorySlug(null);
    setRecorded(null);
    try {
      const token = await getIdToken(true);
      if (!token) {
        setError('Sign in required');
        return;
      }
      const body = await postStoryPacketReview(token, row.submissionId, decision, note);
      if (body.storyDraft) setStorySlug(body.storyDraft.slug);
      setRecorded(decision);
      setNote('');
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
      {recorded ? (
        <p className="story-review__notice" role="status">
          Review recorded: {recorded.replace('_', ' ')}.
        </p>
      ) : null}
      {row.review ? (
        <p className="story-review__notice ds-mono">
          Reviewed {row.review.decision} by {row.review.reviewedByEmail} on{' '}
          {formatWhen(row.review.reviewedAt)}
        </p>
      ) : null}
      <section className="story-review__detail" aria-label="Story packet">
        <StoryPacketDetail
          row={row}
          note={note}
          onNoteChange={setNote}
          busy={busy}
          onDecide={(decision) => decide(decision)}
          storySlug={storySlug}
        />
      </section>
    </>
  );
}
