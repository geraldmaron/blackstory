/**
 * API: bulk approve / reject / needs_evidence for staged story packets.
 * Cap 50. Does not publish — approve only records reviews (+ seed handoffs).
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../../../auth/request-auth';
import {
  assertStoryBulkSelection,
  STORY_REVIEW_BULK_LIMIT,
} from '../../../../../stories/story-review-queue';
import {
  recordStoryPacketReviewsBulk,
  type StoryPacketReviewDecision,
} from '../../../../../stories/story-packet-store';

const DECISIONS = new Set<StoryPacketReviewDecision>(['approved', 'rejected', 'needs_evidence']);

type Body = {
  readonly submissionIds?: unknown;
  readonly decision?: string;
  readonly note?: string;
};

export async function POST(request: Request): Promise<Response> {
  try {
    const caller = await authorizeAdminRequest(request.headers);
    const body = (await request.json()) as Body;
    const decision = body.decision;
    if (!decision || !DECISIONS.has(decision as StoryPacketReviewDecision)) {
      return Response.json(
        { error: 'decision must be approved | rejected | needs_evidence' },
        { status: 400 },
      );
    }
    if (
      !Array.isArray(body.submissionIds) ||
      !body.submissionIds.every((id) => typeof id === 'string')
    ) {
      return Response.json({ error: 'submissionIds must be a string array' }, { status: 400 });
    }

    let submissionIds: readonly string[];
    try {
      submissionIds = assertStoryBulkSelection(body.submissionIds, STORY_REVIEW_BULK_LIMIT);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }

    const { results } = await recordStoryPacketReviewsBulk({
      submissionIds,
      decision: decision as StoryPacketReviewDecision,
      reviewedByEmail: caller.email,
      reviewedByUid: caller.uid,
      ...(body.note !== undefined ? { note: body.note } : {}),
    });

    const succeeded = results.filter((row) => row.ok).length;
    const failed = results.length - succeeded;
    const seedHandoffs = results
      .filter((row) => row.ok && row.seedHandoff)
      .map((row) => ({ submissionId: row.submissionId, seedHandoff: row.seedHandoff }));

    return Response.json({
      ok: failed === 0,
      decision,
      succeeded,
      failed,
      limit: STORY_REVIEW_BULK_LIMIT,
      results,
      seedHandoffs,
      published: false,
      note: 'Bulk review records private decisions only. Release activation remains a separate independently authorized action.',
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
