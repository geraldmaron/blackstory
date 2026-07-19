/**
 * GET /api/audit — list recent append-only audit events.
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../auth/request-auth';
import { listRecentAuditEvents } from '../../../ops/audit-store';

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeAdminRequest(request.headers);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const items = await listRecentAuditEvents(limit);
    return Response.json({ items, count: items.length });
  } catch (error) {
    return authErrorResponse(error);
  }
}
