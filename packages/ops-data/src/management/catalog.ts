import type { Pool, PoolClient } from 'pg';
import { workDigest } from './work-store.js';
export async function managementEntitySnapshot(db: Pick<PoolClient, 'query'>, entityId: string) {
  const result = await db.query(
    `SELECT to_jsonb(e) AS entity,
    COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM canonical.entity_locations l WHERE l.entity_id=e.id),'[]'::jsonb) AS locations,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('claim',to_jsonb(c),'version',to_jsonb(v)) ORDER BY c.id)
      FROM canonical.claims c LEFT JOIN canonical.claim_versions v ON v.id=c.current_version_id WHERE c.entity_id=e.id),'[]'::jsonb) AS claims
    FROM canonical.entities e WHERE e.id=$1`,
    [entityId],
  );
  return result.rows[0] ?? null;
}
export async function managementCatalog(pool: Pool, request: string) {
  const terms = [...new Set(request.match(/[\p{L}\d]{4,}/gu) ?? [])]
    .filter(
      (term) =>
        ![
          'research',
          'records',
          'record',
          'create',
          'update',
          'these',
          'those',
          'similar',
          'blackstory',
          'existing',
        ].includes(term.toLowerCase()),
    )
    .slice(0, 12);
  const result = await pool.query(
    `SELECT id,display_name FROM canonical.entities
    WHERE display_name ILIKE ANY($1::text[]) OR aliases::text ILIKE ANY($1::text[])
      OR id=ANY($2::text[]) ORDER BY display_name,id LIMIT 50`,
    [
      terms.map((term) => `%${term.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`),
      request.split(/\s+/u),
    ],
  );
  const rows = [];
  for (const row of result.rows) {
    const snapshot = await managementEntitySnapshot(pool, row.id);
    rows.push({
      id: row.id,
      displayName: row.display_name,
      beforeHash: workDigest(snapshot),
      snapshot,
    });
  }
  return rows;
}
