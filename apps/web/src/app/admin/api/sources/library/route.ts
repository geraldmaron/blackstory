import { querySourceLibrary, sourceLibraryQueryFromParams } from '@repo/ops-data/source-library';
import {
  authorizeAdminRoute,
  authErrorResponse,
  isAdminAuthorizationError,
} from '../../../../../admin/auth/request-auth';
import { getPostgresPool } from '../../../../../admin/lib/canonical-postgres-client';
export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeAdminRoute(request);
    let query;
    try {
      query = sourceLibraryQueryFromParams(new URL(request.url).searchParams);
    } catch {
      return Response.json({ error: 'Invalid source-library query' }, { status: 400 });
    }
    return Response.json(await querySourceLibrary(getPostgresPool(), query), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (isAdminAuthorizationError(error)) return authErrorResponse(error);
    return Response.json({ error: 'Source library is unavailable' }, { status: 503 });
  }
}
