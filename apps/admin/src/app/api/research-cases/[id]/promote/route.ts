/**
 * POST /api/research-cases/[id]/promote — promote a research case's proposed record to a
 * canonical entity (repo-k2kb). Requires the `admin` or `publication` staff role; `research`
 * cannot call this (proposer/approver separation see promote-case.ts's header).
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../../../auth/request-auth';
import { CasePromotionRejected, promoteCaseToCanonical } from '../../../../../cases/promote-case';
import type { CanonicalPromotionRecord } from '@repo/domain';

const APPROVER_ROLES = new Set(['admin', 'publication']);

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
    const caller = await authorizeAdminRequest(request.headers);
    if (!APPROVER_ROLES.has(caller.role)) {
      return Response.json(
        { error: 'Promoting a case to canonical requires the admin or publication role' },
        { status: 403 },
      );
    }
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
