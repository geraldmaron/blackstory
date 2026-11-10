import { authorizeAdminRoute } from '@/admin/auth/request-auth';
import { queryPostgres } from '@/admin/lib/canonical-postgres-client';
import { editorialError } from '@/admin/editorial/http';
export async function GET(request: Request) {
  try {
    await authorizeAdminRoute(request);
    const q = new URL(request.url).searchParams.get('q')?.trim().slice(0, 120) ?? '';
    // `id` and `display_name` are what AdminRecordPicker reads. `kind`, `place` and `published`
    // are for the story editor's @ menu: published means the record is in the active release.
    const items = q
      ? await queryPostgres(
          `SELECT e.id, e.display_name, e.kind,
                  re.projection->>'locationLabel' AS place,
                  (re.entity_id IS NOT NULL) AS published
             FROM canonical.entities e
             LEFT JOIN published.release_entities re
               ON re.entity_id = e.id
              AND re.release_id = (SELECT release_id FROM published.v_active_release_id LIMIT 1)
            WHERE COALESCE(e.merge_state->>'status','')<>'absorbed'
              AND (e.display_name ILIKE $1 OR e.id=$2)
            ORDER BY e.display_name
            LIMIT 30`,
          [`%${q}%`, q],
        )
      : [];
    return Response.json({ items });
  } catch (e) {
    return editorialError(e);
  }
}
