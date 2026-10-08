import {
  authorizeAdminRoute,
  authErrorResponse,
  isAdminAuthorizationError,
} from '../../../../../../admin/auth/request-auth';
import { completeAdminResearchCaseChecklist } from '../../../../../../admin/cases/research-case-store';

/** Complete evidence-backed case readiness. This writes no public release data. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const caller = await authorizeAdminRoute(request);
    const { id } = await context.params;
    const body = (await request.json()) as { checklist?: unknown; reason?: unknown };
    if (typeof body.reason !== 'string' || !body.reason.trim()) {
      return Response.json({ error: 'reason is required' }, { status: 400 });
    }
    const result = await completeAdminResearchCaseChecklist({
      caseId: id,
      checklist: body.checklist,
      reason: body.reason,
      actorUid: caller.uid,
      actorEmail: caller.email,
    });
    return Response.json({
      ok: true,
      item: result.detail,
      auditEventId: result.auditEventId,
      published: false,
    });
  } catch (error) {
    if (isAdminAuthorizationError(error)) return authErrorResponse(error);
    if (error instanceof Error) {
      return Response.json(
        { error: error.message },
        { status: /not found/i.test(error.message) ? 404 : 400 },
      );
    }
    return authErrorResponse(error);
  }
}
