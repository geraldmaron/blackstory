import { authorizeAdminRoute } from '@/admin/auth/request-auth';
import { queryPostgres } from '@/admin/lib/canonical-postgres-client';
import { editorialError } from '@/admin/editorial/http';

const MAX_IDS = 100;

/** Era and topic facets of the published records a story links to, for tag suggestions. */
export async function GET(request: Request) {
  try {
    await authorizeAdminRoute(request);
    const ids = [
      ...new Set(
        (new URL(request.url).searchParams.get('ids') ?? '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ].slice(0, MAX_IDS);
    const rows = ids.length
      ? await queryPostgres<{
          entity_id: string;
          display_name: string;
          kind: string;
          era: unknown;
          topics: unknown;
        }>(
          `SELECT re.entity_id, re.display_name, re.kind,
                  re.projection->'eraBuckets' AS era, re.projection->'topicTags' AS topics
             FROM published.release_entities re
             JOIN published.active_release ar ON ar.release_id = re.release_id
            WHERE re.entity_id = ANY($1::text[])`,
          [ids],
        )
      : [];
    const strings = (value: unknown) =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
    return Response.json({
      items: rows.map((row) => ({
        id: row.entity_id,
        displayName: row.display_name,
        kind: row.kind,
        published: true,
        eraBuckets: strings(row.era),
        topicTags: strings(row.topics),
      })),
    });
  } catch (e) {
    return editorialError(e);
  }
}
