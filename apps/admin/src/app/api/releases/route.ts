/**
 * GET /api/releases — list publication releases and the active public release pointer.
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../auth/request-auth';
import { listPublicationReleases } from '../../../releases/releases-store';

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeAdminRequest(request.headers);
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
