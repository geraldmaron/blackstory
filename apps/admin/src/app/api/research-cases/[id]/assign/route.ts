/**
 * POST /api/research-cases/[id]/assign — assign a research case to a reviewer.
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../../../auth/request-auth';
import { assignAdminResearchCase } from '../../../../../cases/research-case-store';
import type { ReviewPriority } from '@repo/domain';

type Body = {
  readonly reviewerId?: string;
  readonly priority?: string;
  readonly reason?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const caller = await authorizeAdminRequest(request.headers);
    const { id } = await context.params;
    const body = (await request.json()) as Body;
    const reviewerId = body.reviewerId?.trim() || caller.uid;

    const result = await assignAdminResearchCase({
      caseId: id,
      reviewerId,
      assignedBy: caller.uid,
      actorUid: caller.uid,
      actorEmail: caller.email,
      ...(body.priority ? { priority: body.priority as ReviewPriority } : {}),
      ...(body.reason ? { reason: body.reason } : {}),
    });

    return Response.json({
      ok: true,
      item: result.detail,
      auditEventId: result.auditEventId,
    });
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
