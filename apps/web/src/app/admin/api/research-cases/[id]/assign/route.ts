/**
 * POST /api/research-cases/[id]/assign — assign a research case to a reviewer.
 */
import {
  authorizeAdminRoute,
  authErrorResponse,
  isAdminAuthorizationError,
} from '../../../../../../admin/auth/request-auth';
import { assignAdminResearchCase } from '../../../../../../admin/cases/research-case-store';
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
    const caller = await authorizeAdminRoute(request);
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
    // Asked before the domain mappings below: an authorization failure is a 401 or 403, and
    // falling through to the generic handler would answer it with 400.
    if (isAdminAuthorizationError(error)) {
      return authErrorResponse(error);
    }
    if (error instanceof Error && /not found/i.test(error.message)) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
