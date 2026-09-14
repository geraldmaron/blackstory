/**
 * GET /api/releases — list publication releases and the active public release pointer.
 */
import { authorizeAdminRoute, authErrorResponse } from '../../../../admin/auth/request-auth';
import { listPublicationReleases } from '../../../../admin/releases/releases-store';

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeAdminRoute(request);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '50');
    const result = await listPublicationReleases(limit);
    return Response.json({
      items: result.items,
      count: result.items.length,
      activeRelease: result.activeRelease,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
