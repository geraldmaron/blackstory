/**
 * GET /api/sources — list registered source organizations.
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../auth/request-auth';
import { listSourceOrganizations } from '../../../sources/sources-store';

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeAdminRequest(request.headers);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const items = await listSourceOrganizations(limit);
    return Response.json({ items, count: items.length });
  } catch (error) {
    return authErrorResponse(error);
  }
}
