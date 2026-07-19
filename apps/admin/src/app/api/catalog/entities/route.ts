/**
 * GET /api/catalog/entities — list canonical entities with optional search filter.
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../../auth/request-auth';
import { listCanonicalEntities } from '../../../../catalog/catalog-store';

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeAdminRequest(request.headers);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const search = url.searchParams.get('search') ?? undefined;
    const items = await listCanonicalEntities(limit, search);
    return Response.json({ items, count: items.length });
  } catch (error) {
    return authErrorResponse(error);
  }
}
