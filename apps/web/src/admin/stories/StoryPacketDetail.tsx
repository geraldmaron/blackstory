/**
 * The selected-packet detail and decision panel, shared by the story review desk and the
 * by-id packet page so both show the same packet and offer the same review decision.
 *
 * Pure presentation plus the "open editable story draft" import call; the caller owns the
 * decision state (note, busy) and what a decision does afterwards.
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { StoryResearchPacket } from '@repo/domain';
import { useAdminAuth } from '../auth/AdminAuthProvider';
import { FormButton, FormTextarea } from '../design-system/fields';
import {
  storyReviewActionHelp,
  storyReviewActionLabel,
  type StoryReviewAction,
} from './story-review-copy';

type ReviewState = {
  readonly decision: string;
  readonly reviewedAt: string;
  readonly reviewedByEmail: string;
};

export type PacketRow = {
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

export function reviewLabel(row: PacketRow): string {
  return row.review?.decision ?? 'pending';
}

export function formatWhen(iso: string): string {
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

export type StoryPacketDetailProps = {
  readonly row: PacketRow;
  readonly note: string;
  readonly onNoteChange: (note: string) => void;
  readonly busy: boolean;
  readonly onDecide: (
    decision: 'approved' | 'rejected' | 'needs_evidence',
    submissionIds: readonly string[],
  ) => void | Promise<void>;
  /** Slug of the story draft a single approval just created. */
  readonly storySlug?: string | null;
  /** Drafts a bulk approval just created (desk only). */
  readonly bulkDrafts?: readonly { submissionId: string; slug: string }[];
};

export function StoryPacketDetail({
  row,
  note,
  onNoteChange,
  busy,
  onDecide,
  storySlug = null,
  bulkDrafts = [],
}: StoryPacketDetailProps) {
  const { getIdToken } = useAdminAuth();
  const router = useRouter();
  return (
    <>
      <p className="story-review__detail-meta ds-mono">
        {reviewLabel(row)} · proposal {row.decision} · {row.packet.draft.eraLabel} ·{' '}
        {row.packet.draft.placeLabel}
      </p>
      <h2 className="ds-section__title">{row.packet.draft.title}</h2>
      <p className="ds-page__lede">{row.packet.draft.dek}</p>
      <p className="ds-sans">
        Confidence {(row.packet.confidence * 100).toFixed(0)}% · topic{' '}
        <span className="ds-mono">{row.topicId}</span>
      </p>
      <p className="ds-sans">{row.packet.rationale}</p>
      <p className="ds-sans">
        <FormButton
          onClick={async () => {
            try {
              const token = await getIdToken();
              const response = await fetch('/admin/api/stories/import', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ submissionId: row.submissionId }),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.error);
              router.push(`/admin/stories/${data.slug}`);
            } catch (error) {
              window.alert(error instanceof Error ? error.message : 'Article import failed.');
            }
          }}
        >
          Open editable story draft
        </FormButton>
        {' · '}The packet remains private research. Review sources and credits in the story editor.
      </p>

      {row.packet.validationIssues.length > 0 ? (
        <div className="story-review__issues">
          <h3 className="ds-section__title">Validation issues</h3>
          <ul>
            {row.packet.validationIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <h3 className="ds-section__title">Research brief</h3>
      <dl className="story-review__brief">
        <div>
          <dt>Thesis</dt>
          <dd>{row.packet.brief.thesisQuestion}</dd>
        </div>
        <div>
          <dt>Conventional start</dt>
          <dd>{row.packet.brief.conventionalStartLine}</dd>
        </div>
        <div>
          <dt>Relocated start</dt>
          <dd>{row.packet.brief.relocatedStartLine}</dd>
        </div>
        {row.packet.brief.mechanismLayers.length > 0 ? (
          <div>
            <dt>Mechanisms</dt>
            <dd>
              <ul>
                {row.packet.brief.mechanismLayers.map((layer) => (
                  <li key={`${layer.kind}-${layer.summary.slice(0, 24)}`}>
                    <span className="ds-mono">{layer.kind}</span> — {layer.summary}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>

      {row.packet.anchors.length > 0 ? (
        <>
          <h3 className="ds-section__title">Anchors</h3>
          <ul className="story-review__anchors">
            {row.packet.anchors.map((anchor) => (
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
        {row.packet.draft.body.map((section, index) => (
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
        {row.packet.citeMap.map((entry) => (
          <li key={entry.sentenceId}>
            {entry.sentenceId}: {entry.citeKind}
            {entry.citeId ? ` → ${entry.citeId}` : ''}
          </li>
        ))}
      </ul>

      <label className="story-review__field story-review__note">
        <span>Decision note (optional)</span>
        <FormTextarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          rows={3}
          placeholder="Example: Strong cite map; approve for research handoff after one more primary source"
        />
      </label>

      <div className="acq-sheet__decide">
        <h3 className="acq-sheet__decide-title">Decide</h3>
        <p className="acq-sheet__decide-lede">
          Approval records your review and may return a research handoff — it does not publish. For
          missing sources, <Link href="/admin/evidence">attach evidence</Link> before re-running
          story research.
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
              <strong>{storyReviewActionLabel(action)}.</strong> {storyReviewActionHelp(action)}
            </li>
          ))}
        </ul>
      </div>

      <div className="story-review__actions">
        <FormButton
          type="button"
          className="ds-button ds-button--primary"
          disabled={busy}
          title={storyReviewActionHelp('approved')}
          onClick={() => void onDecide('approved', [row.submissionId])}
        >
          Approve
        </FormButton>
        <FormButton
          type="button"
          className="ds-button ds-button--secondary"
          disabled={busy}
          title={storyReviewActionHelp('needs_evidence')}
          onClick={() => void onDecide('needs_evidence', [row.submissionId])}
        >
          Needs evidence
        </FormButton>
        <FormButton
          type="button"
          className="ds-button ds-button--secondary"
          disabled={busy}
          title={storyReviewActionHelp('rejected')}
          onClick={() => void onDecide('rejected', [row.submissionId])}
        >
          Reject
        </FormButton>
      </div>

      {storySlug && (
        <p>
          <Link href={`/admin/stories/${storySlug}`}>Continue editing the story draft</Link>
        </p>
      )}
      {bulkDrafts.length > 0 && (
        <ul>
          {bulkDrafts.map((story) => (
            <li key={story.submissionId}>
              <Link href={`/admin/stories/${story.slug}`}>Edit {story.slug}</Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
