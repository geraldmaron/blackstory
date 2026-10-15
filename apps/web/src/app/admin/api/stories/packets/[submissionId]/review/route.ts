/**
 * API: record approve / reject / needs_evidence for a story_packet.
 * Approval creates a durable editable draft; article publication still needs exact-revision review.
 */
import { importStoryPacket } from '@/admin/editorial/packet';
import { editorialError } from '@/admin/editorial/http';
import { authorizeAdminRoute } from '../../../../../../../admin/auth/request-auth';
import {
  recordStoryPacketReview,
  type StoryPacketReviewDecision,
} from '../../../../../../../admin/stories/story-packet-store';

const DECISIONS = new Set<StoryPacketReviewDecision>(['approved', 'rejected', 'needs_evidence']);

type Body = {
  readonly decision?: string;
  readonly note?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ submissionId: string }> },
): Promise<Response> {
  try {
    const caller = await authorizeAdminRoute(request);
    const { submissionId } = await context.params;
    const body = (await request.json()) as Body;
    const decision = body.decision;
    if (!decision || !DECISIONS.has(decision as StoryPacketReviewDecision)) {
      return Response.json(
        { error: 'decision must be approved | rejected | needs_evidence' },
        { status: 400 },
      );
    }

    const articleDraft =
      decision === 'approved' ? await importStoryPacket(caller, submissionId) : null;
    const result = await recordStoryPacketReview({
      submissionId,
      decision: decision as StoryPacketReviewDecision,
      reviewedByEmail: caller.email,
      reviewedByUid: caller.uid,
      ...(body.note !== undefined ? { note: body.note } : {}),
    });

    return Response.json({
      ok: true,
      submissionId,
      review: result.review,
      articleDraft,
      published: false,
      note: 'Approval records a private review decision only. Release activation remains separate.',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    return editorialError(error);
  }
}
