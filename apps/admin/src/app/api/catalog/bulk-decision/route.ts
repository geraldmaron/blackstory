/**
 * POST /api/catalog/bulk-decision — bounded bulk decisions on published catalog entities
 * (max 50). Records flag_for_retraction / needs_review / clear_flag only — never mutates the
 * entity or a release. The release builder reads the latest decision per entity; the existing
 * signed-manifest privileged-apply flow is what actually changes what's live.
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../../auth/request-auth';
import {
  bulkRecordCatalogDecisions,
  CATALOG_DECISION_ACTIONS,
  CATALOG_BULK_DECISION_LIMIT,
  type CatalogDecisionAction,
} from '../../../../catalog/catalog-decisions-store';

const ACTIONS = new Set<CatalogDecisionAction>(CATALOG_DECISION_ACTIONS);

type Body = {
  readonly entityIds?: unknown;
  readonly action?: string;
  readonly reason?: string;
};

export async function POST(request: Request): Promise<Response> {
  try {
    const caller = await authorizeAdminRequest(request.headers);
    const body = (await request.json()) as Body;

    if (!body.action || !ACTIONS.has(body.action as CatalogDecisionAction)) {
      return Response.json(
        { error: `action must be one of: ${CATALOG_DECISION_ACTIONS.join(', ')}` },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.entityIds) || !body.entityIds.every((id) => typeof id === 'string')) {
      return Response.json({ error: 'entityIds must be a string array' }, { status: 400 });
    }
    if (!body.reason?.trim()) {
      return Response.json({ error: 'reason is required' }, { status: 400 });
    }
    if (body.entityIds.length > CATALOG_BULK_DECISION_LIMIT) {
      return Response.json(
        { error: `Bulk catalog decisions are limited to ${CATALOG_BULK_DECISION_LIMIT} entities` },
        { status: 400 },
      );
    }

    const result = await bulkRecordCatalogDecisions({
      entityIds: body.entityIds,
      action: body.action as CatalogDecisionAction,
      reason: body.reason.trim(),
      actorUid: caller.uid,
      actorEmail: caller.email,
    });

    return Response.json({
      ok: result.failed === 0,
      action: body.action,
      ...result,
      published: false,
      note: 'Bulk decision recorded only. The release builder reads this on the next release; live publication still requires the existing privileged apply step.',
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
