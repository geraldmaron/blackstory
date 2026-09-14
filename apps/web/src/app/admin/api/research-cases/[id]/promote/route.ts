/**
 * POST /api/research-cases/[id]/promote — promote a research case's proposed record to a
 * canonical entity (repo-k2kb). Gated on `publication:publish`, which the role table grants to
 * `admin` and `publication` only; `research` proposes and cannot approve its own proposal (see
 * promote-case.ts's header).
 */
import {
  authorizeAdminRoute,
  authErrorResponse,
  isAdminAuthorizationError,
} from '../../../../../../admin/auth/request-auth';
import {
  CasePromotionRejected,
  promoteCaseToCanonical,
} from '../../../../../../admin/cases/promote-case';
import type { CanonicalPromotionRecord } from '@repo/domain';

type Body = {
  readonly record?: CanonicalPromotionRecord;
  readonly proposerId?: string;
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
    if (!body.record) {
      return Response.json({ error: 'record is required' }, { status: 400 });
    }
    if (!body.proposerId?.trim()) {
      return Response.json({ error: 'proposerId is required' }, { status: 400 });
    }
    if (!body.reason?.trim()) {
      return Response.json({ error: 'reason is required' }, { status: 400 });
    }

    const result = await promoteCaseToCanonical({
      caseId: id,
      record: body.record,
      proposerId: body.proposerId.trim(),
      approverUid: caller.uid,
      approverEmail: caller.email,
      reason: body.reason.trim(),
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    // Asked before the domain mappings below: an authorization failure is a 401 or 403, and
    // falling through to the generic handler would answer it with 400.
    if (isAdminAuthorizationError(error)) {
      return authErrorResponse(error);
    }
    if (error instanceof CasePromotionRejected) {
      return Response.json({ error: error.message, reasons: error.reasons }, { status: 422 });
    }
    if (error instanceof Error && /not found/i.test(error.message)) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && /duplicate check failed/i.test(error.message)) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
