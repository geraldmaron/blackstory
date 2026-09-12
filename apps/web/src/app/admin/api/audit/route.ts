/**
 * GET /api/audit — list recent append-only audit events.
 */
import { authorizeAdminRoute, authErrorResponse } from '../../../../admin/auth/request-auth';
import { listRecentAuditEvents } from '../../../../admin/ops/audit-store';

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeAdminRoute(request);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const items = await listRecentAuditEvents(limit);
    return Response.json({ items, count: items.length });
  } catch (error) {
    return authErrorResponse(error);
  }
}
