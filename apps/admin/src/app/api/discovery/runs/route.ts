/**
 * GET /api/discovery/runs — list private discovery campaign run records.
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../../auth/request-auth';
import { listDiscoveryCampaignRuns } from '../../../../ops/discovery-ops-store';

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeAdminRequest(request.headers);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '50');
    const items = await listDiscoveryCampaignRuns(limit);
    return Response.json({ items, count: items.length });
  } catch (error) {
    return authErrorResponse(error);
  }
}
