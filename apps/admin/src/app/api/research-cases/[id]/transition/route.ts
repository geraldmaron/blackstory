/**
 * POST /api/research-cases/[id]/transition — advance or exclude a research case.
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../../../auth/request-auth';
import { transitionAdminResearchCase } from '../../../../../cases/research-case-store';
import type {
  AdminCaseTransitionAction,
  AdminCaseTransitionRequest,
} from '../../../../../cases/research-case-types';
import type { ResearchCaseReasonCode } from '@repo/domain';

const ACTIONS = new Set<AdminCaseTransitionAction>([
  'send_to_relevance',
  'confirm_relevance',
  'needs_evidence',
  'exclude',
  'merge',
]);

type Body = {
  readonly action?: string;
  readonly reason?: string;
  readonly reasonCode?: string;
  readonly mergedIntoCaseId?: string;
  readonly evidenceIds?: readonly string[];
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const caller = await authorizeAdminRequest(request.headers);
    const { id } = await context.params;
    const body = (await request.json()) as Body;
    if (!body.action || !ACTIONS.has(body.action as AdminCaseTransitionAction)) {
      return Response.json(
        {
          error:
            'action must be send_to_relevance | confirm_relevance | needs_evidence | exclude | merge',
        },
        { status: 400 },
      );
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
      ...(body.evidenceIds ? { evidenceIds: body.evidenceIds } : {}),
    };

    const result = await transitionAdminResearchCase({
      caseId: id,
      request: transitionRequest,
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
    if (error instanceof Error && /not found/i.test(error.message)) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
