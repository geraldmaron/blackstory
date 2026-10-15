import { authorizeAdminRoute } from '@/admin/auth/request-auth';
import { queryPostgres } from '@/admin/lib/canonical-postgres-client';
import { editorialError } from '@/admin/editorial/http';
export async function GET(request: Request) {
  try {
    await authorizeAdminRoute(request);
    const q = new URL(request.url).searchParams.get('q')?.trim().slice(0, 120) ?? '';
    const items = q
      ? await queryPostgres(
          `SELECT id,display_name FROM canonical.entities WHERE COALESCE(merge_state->>'status','')<>'absorbed' AND (display_name ILIKE $1 OR id=$2) ORDER BY display_name LIMIT 30`,
          [`%${q}%`, q],
        )
      : [];
    return Response.json({ items });
  } catch (e) {
    return editorialError(e);
  }
}
