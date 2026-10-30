/**
 * Reads the Footprint: the published rows aggregated by buildFootprint, plus how many live
 * canonical records the active release does not contain.
 */
import { queryPostgres } from './canonical-postgres-client.js';
import { buildFootprint, type Footprint } from './footprint.js';
import { readPublishedJurisdictions } from './published-jurisdictions.js';

export type FootprintReading = Footprint & { readonly unpublishedCanonical: number };

export async function readFootprint(): Promise<FootprintReading> {
  const published = await readPublishedJurisdictions();
  const footprint = buildFootprint(published);
  const counts = await queryPostgres<{ readonly total: string }>(
    `SELECT count(*)::text AS total FROM canonical.entities e WHERE (e.merge_state IS NULL OR e.merge_state->>'status' IS DISTINCT FROM 'absorbed') AND NOT EXISTS (SELECT 1 FROM published.search_index s WHERE s.release_id = $1 AND s.entity_id = e.id)`,
    [published.releaseId],
  );
  return { ...footprint, unpublishedCanonical: Number(counts[0]?.total ?? 0) };
}
