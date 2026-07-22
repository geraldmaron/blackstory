/** Postgres access for staged story packets and review decisions. */
import type { StoryResearchPacket, storyPacketToSeedRecord } from '@repo/domain';
import {
  getStoryPacketPostgres,
  listStoryPacketsPostgres,
  recordStoryPacketReviewPostgres,
} from '@/lib/postgres-story-packets';

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

export async function listStoryPackets(limit = 200): Promise<readonly StoryPacketListItem[]> {
  return listStoryPacketsPostgres(limit);
}

export async function getStoryPacket(submissionId: string): Promise<StoryPacketListItem | null> {
  return getStoryPacketPostgres(submissionId);
}

export async function recordStoryPacketReview(input: {
  readonly submissionId: string;
  readonly decision: StoryPacketReviewDecision;
  readonly reviewedByEmail: string;
  readonly reviewedByUid: string;
  readonly note?: string;
}): Promise<{
  readonly review: {
    readonly decision: StoryPacketReviewDecision;
    readonly reviewedAt: string;
    readonly reviewedByEmail: string;
  };
  readonly seedHandoff?: ReturnType<typeof storyPacketToSeedRecord>;
}> {
  const item = await getStoryPacket(input.submissionId);
  if (!item) throw new Error(`Story packet submission not found: ${input.submissionId}`);
  return recordStoryPacketReviewPostgres({
    submissionId: input.submissionId,
    decision: input.decision,
    reviewedByEmail: input.reviewedByEmail,
    reviewedByUid: input.reviewedByUid,
    ...(input.note !== undefined ? { note: input.note } : {}),
    item,
  });
}

export async function recordStoryPacketReviewsBulk(input: {
  readonly submissionIds: readonly string[];
  readonly decision: StoryPacketReviewDecision;
  readonly reviewedByEmail: string;
  readonly reviewedByUid: string;
  readonly note?: string;
}): Promise<{
  readonly results: readonly {
    readonly submissionId: string;
    readonly ok: boolean;
    readonly error?: string;
    readonly review?: {
      readonly decision: StoryPacketReviewDecision;
      readonly reviewedAt: string;
      readonly reviewedByEmail: string;
    };
    readonly seedHandoff?: ReturnType<typeof storyPacketToSeedRecord>;
  }[];
}> {
  const results = [];
  for (const submissionId of input.submissionIds) {
    try {
      const recorded = await recordStoryPacketReview({
        submissionId,
        decision: input.decision,
        reviewedByEmail: input.reviewedByEmail,
        reviewedByUid: input.reviewedByUid,
        ...(input.note !== undefined ? { note: input.note } : {}),
      });
      results.push({
        submissionId,
        ok: true,
        review: recorded.review,
        ...(recorded.seedHandoff ? { seedHandoff: recorded.seedHandoff } : {}),
      });
    } catch (error) {
      results.push({ submissionId, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { results: Object.freeze(results) };
}
