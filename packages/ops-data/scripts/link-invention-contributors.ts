/**
 * Creates person-to-invention contribution edges from cited cohort records. Missing entity
 * identifiers are reported and skipped. Dry-run unless DRY_RUN=0 and APPLY=1; public related
 * lists must reflect both endpoints after publication.
 */
import { createHash } from 'node:crypto';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { INVENTION_COHORT } from './data/invention-cohort.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.APPLY === '1';

type PlannedEdge = {
  readonly id: string;
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly relationshipType: string;
  readonly contributorName: string;
  readonly inventionName: string;
};

/**
 * Deterministic id so a re-run updates the same row instead of adding a second edge for the
 * same fact. Same shape as the release linker's `rel_release_<hash>` ids.
 */
function edgeId(from: string, to: string, type: string): string {
  const hash = createHash('md5').update(`${from}|${type}|${to}`).digest('hex');
  return `rel_invention_${hash}`;
}

export function planContributorEdges(): {
  readonly edges: readonly PlannedEdge[];
  readonly unmodeled: readonly { readonly name: string; readonly invention: string }[];
} {
  const edges: PlannedEdge[] = [];
  const unmodeled: { name: string; invention: string }[] = [];
  for (const invention of INVENTION_COHORT) {
    for (const contributor of invention.contributors) {
      if (contributor.entityId === undefined) {
        unmodeled.push({ name: contributor.name, invention: invention.displayName });
        continue;
      }
      edges.push({
        id: edgeId(contributor.entityId, invention.id, contributor.predicate),
        fromEntityId: contributor.entityId,
        toEntityId: invention.id,
        relationshipType: contributor.predicate,
        contributorName: contributor.name,
        inventionName: invention.displayName,
      });
    }
  }
  return { edges, unmodeled };
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const { edges, unmodeled } = planContributorEdges();
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString);
  const client = new pg.Client({ connectionString: cs, ...(ssl ? { ssl } : {}) });
  await client.connect();
  try {
    // Never write an edge to an entity that does not exist: a dangling id publishes a `related`
    // entry that renders as a link to nothing.
    const ids = [...new Set(edges.flatMap((edge) => [edge.fromEntityId, edge.toEntityId]))];
    const present = await client.query<{ id: string }>(
      'SELECT id FROM canonical.entities WHERE id = ANY($1)',
      [ids],
    );
    const known = new Set(present.rows.map((row) => row.id));
    const writable = edges.filter(
      (edge) => known.has(edge.fromEntityId) && known.has(edge.toEntityId),
    );
    const missing = edges.filter(
      (edge) => !known.has(edge.fromEntityId) || !known.has(edge.toEntityId),
    );

    console.log(`planned edges: ${edges.length}`);
    console.log(`writable:      ${writable.length}`);
    console.log(DRY_RUN || !APPLY ? 'dry-run' : 'apply');
    for (const edge of writable) {
      console.log(`  ${edge.contributorName} --${edge.relationshipType}--> ${edge.inventionName}`);
    }
    if (missing.length > 0) {
      console.log(`\nskipped, entity not in canonical (${missing.length}):`);
      for (const edge of missing) {
        const absent = [edge.fromEntityId, edge.toEntityId].filter((id) => !known.has(id));
        console.log(
          `  ${edge.contributorName} -> ${edge.inventionName}  missing: ${absent.join(', ')}`,
        );
      }
    }
    if (unmodeled.length > 0) {
      console.log(`\nnamed on the receipt, no person record by design (${unmodeled.length}):`);
      for (const entry of unmodeled) {
        console.log(`  ${entry.name} — ${entry.invention}`);
      }
    }

    if (DRY_RUN || !APPLY) return;

    for (const edge of writable) {
      await client.query(
        `INSERT INTO canonical.entity_relationships
           (id, from_entity_id, to_entity_id, relationship_type, workflow_status,
            publication_status, confidence, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'accepted','published',$5::jsonb, now(), now())
         ON CONFLICT (id) DO UPDATE SET
           relationship_type = EXCLUDED.relationship_type,
           workflow_status = EXCLUDED.workflow_status,
           publication_status = EXCLUDED.publication_status,
           confidence = EXCLUDED.confidence,
           updated_at = now()`,
        [
          edge.id,
          edge.fromEntityId,
          edge.toEntityId,
          edge.relationshipType,
          JSON.stringify({ level: 'high', source: 'invention_cohort_receipt' }),
        ],
      );
    }
    console.log(`\nwrote ${writable.length} edges`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
