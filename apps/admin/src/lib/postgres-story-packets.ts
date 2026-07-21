/**
 * Postgres reads/writes for story packets in bb_submissions.intake_items and bb_ops.story_packet_reviews.
 */
import type { StoryResearchPacket } from '@repo/domain';
import { storyPacketToSeedRecord } from '@repo/domain';
import { queryPostgres } from './postgres-client.js';

export type StoryPacketReviewDecision = 'approved' | 'rejected' | 'needs_evidence';

export type StoryPacketListItem = {
  readonly submissionId: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly title: string;
  readonly decision: string;
  readonly topicId: string;
  readonly validationIssueCount: number;
  readonly review?: {
    readonly decision: StoryPacketReviewDecision;
    readonly reviewedAt: string;
    readonly reviewedByEmail: string;
  };
  readonly packet: StoryResearchPacket;
};

type IntakeRow = {
  readonly id: string;
  readonly created_by: string;
  readonly payload: Record<string, unknown>;
  readonly created_at: Date | string;
};

type ReviewRow = {
  readonly submission_id: string;
  readonly decision: StoryPacketReviewDecision | null;
  readonly reviewer_id: string | null;
  readonly notes: string | null;
  readonly packet: Record<string, unknown> | null;
  readonly updated_at: Date | string;
};

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function storyPacketSeedSources(
  packet: StoryResearchPacket,
): readonly { readonly label: string; readonly url: string }[] {
  return packet.authorityLeadUrls.map((url) => ({ label: url, url }));
}

function extractPacket(payload: Record<string, unknown> | undefined): StoryResearchPacket | null {
  if (!payload) return null;
  const proposalKind = payload.proposalKind;
  if (proposalKind !== undefined && proposalKind !== 'story_packet') return null;

  const nested = payload.storyPacket;
  if (
    nested &&
    typeof nested === 'object' &&
    (nested as { kind?: string }).kind === 'story.research.packet.v1'
  ) {
    return nested as StoryResearchPacket;
  }

  const statement = typeof payload.statement === 'string' ? payload.statement : '';
  const marker = 'packetJson=';
  const idx = statement.indexOf(marker);
  if (idx >= 0) {
    const raw = statement.slice(idx + marker.length);
    try {
      const parsed = JSON.parse(raw) as StoryResearchPacket;
      if (parsed?.kind === 'story.research.packet.v1') return parsed;
    } catch {
      // fall through
    }
  }

  return null;
}

function readReviewMeta(packet: Record<string, unknown> | null): {
  readonly reviewedByEmail?: string;
} {
  const adminReview = packet?._adminReview;
  if (!adminReview || typeof adminReview !== 'object') return {};
  const email = readString((adminReview as { reviewedByEmail?: unknown }).reviewedByEmail);
  return email ? { reviewedByEmail: email } : {};
}

function mapReviewRow(row: ReviewRow): StoryPacketListItem['review'] | undefined {
  if (!row.decision) return undefined;
  const meta = readReviewMeta(row.packet);
  const reviewedByEmail = meta.reviewedByEmail ?? row.reviewer_id ?? 'unknown';
  return {
    decision: row.decision,
    reviewedAt: toIso(row.updated_at),
    reviewedByEmail,
  };
}

function buildListItem(
  intake: IntakeRow,
  packet: StoryResearchPacket,
  review?: StoryPacketListItem['review'],
): StoryPacketListItem {
  return {
    submissionId: intake.id,
    createdAt: toIso(intake.created_at),
    createdBy: String(intake.created_by),
    title: packet.draft.title,
    decision: packet.decision,
    topicId: packet.topicId,
    validationIssueCount: packet.validationIssues.length,
    ...(review ? { review } : {}),
    packet,
  };
}

export async function listStoryPacketsPostgres(limit: number): Promise<readonly StoryPacketListItem[]> {
  const capped = Math.min(200, Math.max(1, limit));
  const [intakeRows, reviewRows] = await Promise.all([
    queryPostgres<IntakeRow>(
      `SELECT id, created_by, payload, created_at
       FROM bb_submissions.intake_items
       WHERE payload->>'proposalKind' = 'story_packet'
          OR payload->'storyPacket' IS NOT NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      [capped],
    ),
    queryPostgres<ReviewRow>(
      `SELECT submission_id, decision, reviewer_id, notes, packet, updated_at
       FROM bb_ops.story_packet_reviews`,
    ),
  ]);

  const reviewsById = new Map<string, StoryPacketListItem['review']>();
  for (const row of reviewRows) {
    const review = mapReviewRow(row);
    if (review) reviewsById.set(row.submission_id, review);
  }

  const items: StoryPacketListItem[] = [];
  for (const row of intakeRows) {
    const packet = extractPacket(row.payload);
    if (!packet) continue;
    items.push(buildListItem(row, packet, reviewsById.get(row.id)));
  }
  return Object.freeze(items);
}

export async function getStoryPacketPostgres(submissionId: string): Promise<StoryPacketListItem | null> {
  const intakeRows = await queryPostgres<IntakeRow>(
    `SELECT id, created_by, payload, created_at
     FROM bb_submissions.intake_items
     WHERE id = $1`,
    [submissionId],
  );
  if (intakeRows.length === 0) return null;
  const intake = intakeRows[0]!;
  const packet = extractPacket(intake.payload);
  if (!packet) return null;

  const reviewRows = await queryPostgres<ReviewRow>(
    `SELECT submission_id, decision, reviewer_id, notes, packet, updated_at
     FROM bb_ops.story_packet_reviews
     WHERE submission_id = $1`,
    [submissionId],
  );
  const review = reviewRows[0] ? mapReviewRow(reviewRows[0]) : undefined;
  return buildListItem(intake, packet, review);
}

export async function recordStoryPacketReviewPostgres(input: {
  readonly submissionId: string;
  readonly decision: StoryPacketReviewDecision;
  readonly reviewedByEmail: string;
  readonly reviewedByUid: string;
  readonly note?: string;
  readonly item: StoryPacketListItem;
}): Promise<{
  readonly review: {
    readonly decision: StoryPacketReviewDecision;
    readonly reviewedAt: string;
    readonly reviewedByEmail: string;
  };
  readonly seedHandoff?: ReturnType<typeof storyPacketToSeedRecord>;
}> {
  const reviewedAt = new Date().toISOString();
  const packetWithMeta = {
    ...input.item.packet,
    _adminReview: {
      reviewedByEmail: input.reviewedByEmail,
      reviewedByUid: input.reviewedByUid,
    },
  };

  await queryPostgres(
    `INSERT INTO bb_ops.story_packet_reviews
      (id, submission_id, decision, reviewer_id, notes, packet, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET
       decision = EXCLUDED.decision,
       reviewer_id = EXCLUDED.reviewer_id,
       notes = EXCLUDED.notes,
       packet = EXCLUDED.packet,
       updated_at = EXCLUDED.updated_at`,
    [
      input.submissionId,
      input.submissionId,
      input.decision,
      input.reviewedByUid,
      input.note ?? null,
      JSON.stringify(packetWithMeta),
      reviewedAt,
      reviewedAt,
    ],
  );

  const review = {
    decision: input.decision,
    reviewedAt,
    reviewedByEmail: input.reviewedByEmail,
  };

  if (input.decision === 'approved') {
    return {
      review,
      seedHandoff: storyPacketToSeedRecord(
        input.item.packet,
        reviewedAt.slice(0, 10),
        storyPacketSeedSources(input.item.packet),
      ),
    };
  }
  return { review };
}
