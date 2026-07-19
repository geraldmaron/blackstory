/**
 * GET /api/catalog/entities — list canonical entities with optional search filter.
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../../auth/request-auth';
import { listCanonicalEntities } from '../../../../catalog/catalog-store';
import { listCatalogDecisions } from '../../../../catalog/catalog-decisions-store';

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeAdminRequest(request.headers);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const search = url.searchParams.get('search') ?? undefined;
    const items = await listCanonicalEntities(limit, search);
    const decisions = await listCatalogDecisions(items.map((item) => item.id));
    const withDecisions = items.map((item) => {
      const decision = decisions.get(item.id);
      return decision
        ? { ...item, decision: { action: decision.action, reason: decision.reason } }
        : item;
    });
    return Response.json({ items: withDecisions, count: withDecisions.length });
  } catch (error) {
    return authErrorResponse(error);
  }
}
