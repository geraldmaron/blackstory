/**
 * GET /api/graylist — list discovery graylist entries parked below relevance threshold.
 */
import { authorizeAdminRoute, authErrorResponse } from '../../../../admin/auth/request-auth';
import { listDiscoveryGraylist } from '../../../../admin/ops/graylist-store';

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeAdminRoute(request);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const items = await listDiscoveryGraylist(limit);
    return Response.json({ items, count: items.length });
  } catch (error) {
    return authErrorResponse(error);
  }
}
