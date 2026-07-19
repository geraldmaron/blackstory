/**
 * POST /api/research-cases/bulk-transition — bounded bulk case transitions (max 50).
 */
import type { ResearchCaseReasonCode } from '@repo/domain';
import { authorizeAdminRequest, authErrorResponse } from '../../../../auth/request-auth';
import { bulkTransitionAdminResearchCases } from '../../../../cases/research-case-store';
import type {
  AdminCaseTransitionAction,
  AdminCaseTransitionRequest,
} from '../../../../cases/research-case-types';

const ACTIONS = new Set<AdminCaseTransitionAction>([
  'send_to_relevance',
  'confirm_relevance',
  'needs_evidence',
  'exclude',
  'merge',
]);

type Body = {
  readonly caseIds?: readonly string[];
  readonly action?: string;
  readonly reason?: string;
  readonly reasonCode?: string;
  readonly mergedIntoCaseId?: string;
};

export async function POST(request: Request): Promise<Response> {
  try {
    const caller = await authorizeAdminRequest(request.headers);
    const body = (await request.json()) as Body;
    if (!body.caseIds || !Array.isArray(body.caseIds)) {
      return Response.json({ error: 'caseIds array is required' }, { status: 400 });
    }
    if (!body.action || !ACTIONS.has(body.action as AdminCaseTransitionAction)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (!body.reason?.trim()) {
      return Response.json({ error: 'reason is required' }, { status: 400 });
    }

    const transitionRequest: AdminCaseTransitionRequest = {
      action: body.action as AdminCaseTransitionAction,
      reason: body.reason.trim(),
      ...(body.reasonCode
        ? { reasonCode: body.reasonCode as ResearchCaseReasonCode }
        : {}),
      ...(body.mergedIntoCaseId ? { mergedIntoCaseId: body.mergedIntoCaseId } : {}),
    };

    const result = await bulkTransitionAdminResearchCases({
      caseIds: body.caseIds,
      request: transitionRequest,
      actorUid: caller.uid,
      actorEmail: caller.email,
    });

    return Response.json({ ok: true, ...result, published: false });
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
