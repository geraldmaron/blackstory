/**
 * Link each invention to the people named on it.
 *
 * Measured against the active release on 2026-09-09, ZERO relationship edges touched any
 * invention: the 20 published records named their inventors only inside prose, so a reader on
 * Latimer's page had no way to reach the carbon process and a reader on the carbon process had
 * no way to reach Latimer. The contribution vocabulary to fix that shipped in
 * `20260908120000_invention_kind_and_contribution_predicates` and had no writer.
 *
 * Direction is person -> invention, so the predicate reads as a sentence: Lewis H. Latimer
 * `invented` the Process of Manufacturing Carbons. `related` is projected on both ends, so one
 * edge lights up both pages.
 *
 * A contributor with no `entityId` is skipped and reported, not invented. Gerhard Sessler and
 * Albert L. Brown stay named on their receipts in prose without this archive fabricating a
 * person record for them.
 *
 * Dry-run unless DRY_RUN=0 and APPLY=1.
 *
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx packages/ops-data/scripts/link-invention-contributors.ts
 *   DRY_RUN=0 APPLY=1 node --conditions development --import tsx packages/ops-data/scripts/link-invention-contributors.ts
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
  readonly unmodelled: readonly { readonly name: string; readonly invention: string }[];
} {
  const edges: PlannedEdge[] = [];
  const unmodelled: { name: string; invention: string }[] = [];
  for (const invention of INVENTION_COHORT) {
    for (const contributor of invention.contributors) {
      if (contributor.entityId === undefined) {
        unmodelled.push({ name: contributor.name, invention: invention.displayName });
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
  return { edges, unmodelled };
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const { edges, unmodelled } = planContributorEdges();
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString);
  const client = new pg.Client({ connectionString: cs, ...(ssl ? { ssl } : {}) });
  await client.connect();
  try {
    // Never write an edge to an entity that does not exist: a dangling id publishes a `related`
    // entry that renders as a link to nothing.
    const ids = [...new Set(edges.flatMap((edge) => [edge.fromEntityId, edge.toEntityId]))];
    const present = await client.query<{ id: string }>(
      'SELECT id FROM bb_canonical.entities WHERE id = ANY($1)',
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
      console.log(`\nskipped, entity not in bb_canonical (${missing.length}):`);
      for (const edge of missing) {
        const absent = [edge.fromEntityId, edge.toEntityId].filter((id) => !known.has(id));
        console.log(
          `  ${edge.contributorName} -> ${edge.inventionName}  missing: ${absent.join(', ')}`,
        );
      }
    }
    if (unmodelled.length > 0) {
      console.log(`\nnamed on the receipt, no person record by design (${unmodelled.length}):`);
      for (const entry of unmodelled) {
        console.log(`  ${entry.name} — ${entry.invention}`);
      }
    }

    if (DRY_RUN || !APPLY) return;

    for (const edge of writable) {
      await client.query(
        `INSERT INTO bb_canonical.entity_relationships
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
