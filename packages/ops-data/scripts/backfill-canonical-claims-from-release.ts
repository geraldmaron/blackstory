/**
 * Backfill canonical claims (and their evidence chain) for active-release entities that have
 * none.
 *
 * Why: entities published through the landscape lane / incremental publisher, the invention and
 * inventor cohort scripts, and the research-case bridge write published directly and never reach
 * canonical. Their public claims are fully cited, but the canonical chain
 * claims -> claim_versions -> claim_evidence_links -> evidence.evidence_records ->
 * source_items -> evidence_sources -> source_organizations does not exist for them, so any
 * canonical-side audit or trace misses them.
 *
 * What it does (computed at run time, no ids or claim text embedded here):
 *  - Selects active-release entities with zero canonical.claims rows.
 *  - For each public claim, creates the canonical claim under the SAME id as the public claim,
 *    its current claim_version, and a supporting claim_evidence_link, with the published status
 *    conventions canonical-convergence used for the ~15.7k claims already traced.
 *  - Resolves each citation to the existing evidence library without fragmenting it; see
 *    scripts/lib/canonical-claims-backfill-plan.ts for the rules.
 *  - Never touches published, so published output is unchanged and no catalog republish is due.
 *
 * Transaction: ONE transaction for the whole run. Organizations, domains, evidence sources and
 * source items are shared across entities, and the plan resolves them globally (an organization
 * minted for barnard.edu also absorbs archives.barnard.edu from a different entity). A
 * per-entity commit would let a failure leave shared rows written while the entities that were
 * planned onto them are not, and the next run would plan against a different library. The volume
 * is a few thousand rows, well inside one transaction. The apply path plans INSIDE the write
 * transaction under an advisory lock, so what it writes is exactly what it read, and it verifies
 * row counts before COMMIT and rolls back on any mismatch.
 *
 * Idempotent: once applied, every entity in scope has claims, so a re-run selects nothing and
 * writes nothing. All inserts are also ON CONFLICT DO NOTHING with deterministic ids.
 *
 * Dry run (default) opens a READ ONLY transaction, writes the plan JSON, prints totals.
 *
 * Usage (from repo root):
 *   cd apps/web && set -a && . ./.env.local && set +a && cd -
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-canonical-claims-from-release.ts
 *
 * Apply:
 *   DRY_RUN=0 BACKFILL_CANONICAL_CLAIMS_FROM_RELEASE_APPLY=1 node --conditions development \
 *     --import tsx packages/ops-data/scripts/backfill-canonical-claims-from-release.ts
 *
 * Optional: CANONICAL_BACKFILL_PLAN_OUT=<path> overrides where the plan JSON is written.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';
import {
  buildBackfillPlan,
  collectGeneratedIds,
  type BackfillPlan,
  type PlanSnapshot,
  type SnapshotEntity,
} from './lib/canonical-claims-backfill-plan.ts';
import { connectWithDeadline, normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_CANONICAL_CLAIMS_FROM_RELEASE_APPLY === '1';
const WRITE = !DRY_RUN && APPLY;
const PLAN_OUT =
  process.env.CANONICAL_BACKFILL_PLAN_OUT?.trim() ||
  '/private/tmp/claude-501/-Users-geralddagher-Developer-Projects-blackstory/38a16759-fc36-4480-bd33-0983bd8099ef/scratchpad/source-library/canonical-backfill-plan.json';
const ADVISORY_LOCK_KEY = 'backfill-canonical-claims-from-release';

type Client = pg.PoolClient;

async function ids(client: Client, table: string, candidates: readonly string[]) {
  if (candidates.length === 0) return new Set<string>();
  const result = await client.query<{ id: string }>(
    `SELECT id FROM ${table} WHERE id = ANY($1::text[])`,
    [candidates],
  );
  return new Set(result.rows.map((row) => row.id));
}

async function loadSnapshotBase(
  client: Client,
): Promise<Omit<PlanSnapshot, 'existingGeneratedIds'>> {
  const entityRows = await client.query<{
    entity_id: string;
    kind: string;
    research_coverage: string | null;
    canonical_entity_exists: boolean;
    claims: unknown;
    release_id: string;
  }>(`
    WITH active AS (SELECT release_id FROM published.active_release WHERE id = 'active')
    SELECT re.entity_id, re.kind, re.projection->>'researchCoverage' AS research_coverage,
           (e.id IS NOT NULL) AS canonical_entity_exists, re.claims, active.release_id
    FROM published.release_entities re
    JOIN active ON re.release_id = active.release_id
    LEFT JOIN canonical.entities e ON e.id = re.entity_id
    WHERE NOT EXISTS (SELECT 1 FROM canonical.claims c WHERE c.entity_id = re.entity_id)
    ORDER BY re.entity_id
  `);
  const active = await client.query<{ release_id: string }>(
    `SELECT release_id FROM published.active_release WHERE id = 'active'`,
  );
  const releaseId = active.rows[0]?.release_id;
  if (!releaseId) throw new Error('No active release (published.active_release id=active)');

  const entities: SnapshotEntity[] = entityRows.rows.map((row) => ({
    entityId: row.entity_id,
    kind: row.kind,
    researchCoverage: row.research_coverage,
    canonicalEntityExists: row.canonical_entity_exists,
    claims: row.claims,
  }));

  const hrefs = [
    ...new Set(
      entities.flatMap((entity) =>
        (Array.isArray(entity.claims) ? entity.claims : [])
          .map((claim) =>
            claim && typeof claim === 'object'
              ? (claim as Record<string, unknown>).citationHref
              : null,
          )
          .filter((href): href is string => typeof href === 'string'),
      ),
    ),
  ];
  const publicClaimIds = [
    ...new Set(
      entities.flatMap((entity) =>
        (Array.isArray(entity.claims) ? entity.claims : [])
          .map((claim) =>
            claim && typeof claim === 'object' ? (claim as Record<string, unknown>).id : null,
          )
          .filter((id): id is string => typeof id === 'string'),
      ),
    ),
  ];

  // merged_into_organization_id is added by a separate migration; work with and without it.
  const mergedColumn = await client.query<{ present: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'evidence' AND table_name = 'source_organizations'
        AND column_name = 'merged_into_organization_id'
    ) AS present
  `);
  const hasMergedColumn = mergedColumn.rows[0]?.present === true;

  // Sequential on purpose: one client, one transaction, and pg deprecates concurrent queries.
  const organizations = await client.query<{ id: string; merged: string | null }>(
    `SELECT id, ${hasMergedColumn ? 'merged_into_organization_id' : 'NULL::text'} AS merged
     FROM evidence.source_organizations`,
  );
  const domains = await client.query<{ id: string; organization_id: string; hostname: string }>(
    `SELECT id, organization_id, hostname FROM evidence.source_domains`,
  );
  const sources = await client.query<{
    id: string;
    organization_id: string | null;
    item_count: number;
  }>(
    `SELECT s.id, s.organization_id, count(i.id)::int AS item_count
     FROM evidence.evidence_sources s
     LEFT JOIN evidence.source_items i ON i.source_id = s.id
     GROUP BY s.id, s.organization_id`,
  );
  const items = await client.query<{
    id: string;
    source_id: string;
    stable_identifier: string;
    url: string | null;
  }>(
    `SELECT id, source_id, stable_identifier, url FROM evidence.source_items
     WHERE url = ANY($1::text[]) OR stable_identifier = ANY($1::text[])`,
    [hrefs],
  );
  const itemIds = items.rows.map((row) => row.id);
  const evidence = await client.query<{
    id: string;
    source_item_id: string;
    excerpt: string | null;
  }>(
    `SELECT id, source_item_id, excerpt FROM evidence.evidence_records
     WHERE source_item_id = ANY($1::text[])`,
    [itemIds],
  );

  console.log(
    `merged_into_organization_id column: ${hasMergedColumn ? 'present (followed)' : 'absent'}`,
  );

  return {
    releaseId,
    entities,
    organizations: organizations.rows.map((row) => ({
      id: row.id,
      mergedIntoOrganizationId: row.merged,
    })),
    domains: domains.rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      hostname: row.hostname,
    })),
    sources: sources.rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      itemCount: row.item_count,
    })),
    items: items.rows.map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      stableIdentifier: row.stable_identifier,
      url: row.url,
    })),
    evidence: evidence.rows.map((row) => ({
      id: row.id,
      sourceItemId: row.source_item_id,
      excerpt: row.excerpt,
    })),
    existingClaimIds: await ids(client, 'canonical.claims', publicClaimIds),
  };
}

/**
 * Plan, look up which minted ids already exist, and re-plan until the minted set is stable.
 * Existing ids only ever make the planner reuse or block, so this converges in one or two rounds.
 */
async function planWithExistence(client: Client): Promise<BackfillPlan> {
  const base = await loadSnapshotBase(client);
  const known = {
    organizations: new Set<string>(),
    domains: new Set<string>(),
    sources: new Set<string>(),
    items: new Set<string>(),
    evidence: new Set<string>(),
    claimVersions: new Set<string>(),
    links: new Set<string>(),
  };
  const tables = {
    organizations: 'evidence.source_organizations',
    domains: 'evidence.source_domains',
    sources: 'evidence.evidence_sources',
    items: 'evidence.source_items',
    evidence: 'evidence.evidence_records',
    claimVersions: 'canonical.claim_versions',
    links: 'canonical.claim_evidence_links',
  } as const;
  for (let round = 0; round < 5; round += 1) {
    const plan = buildBackfillPlan({ ...base, existingGeneratedIds: known });
    const generated = collectGeneratedIds(plan);
    let added = 0;
    for (const key of Object.keys(tables) as (keyof typeof tables)[]) {
      for (const id of await ids(client, tables[key], generated[key])) {
        if (!known[key].has(id)) {
          known[key].add(id);
          added += 1;
        }
      }
    }
    if (added === 0) return plan;
  }
  throw new Error('Plan did not converge on minted id existence after 5 rounds');
}

async function insertRows(
  client: Client,
  table: string,
  columns: Record<string, string>,
  rows: readonly object[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const names = Object.keys(columns);
  const recordset = names.map((name) => `${name} ${columns[name]}`).join(', ');
  const result = await client.query(
    `INSERT INTO ${table} (${names.join(', ')})
     SELECT ${names.join(', ')} FROM jsonb_to_recordset($1::jsonb) AS x(${recordset})
     ON CONFLICT DO NOTHING`,
    [JSON.stringify(rows)],
  );
  return result.rowCount ?? 0;
}

async function applyPlan(client: Client, plan: BackfillPlan): Promise<void> {
  const planned = plan.entities.filter((entity) => entity.blocked.length === 0);
  const claims = planned.flatMap((entity) => entity.claims);
  const versions = planned.flatMap((entity) => entity.claimVersions);
  const links = planned.flatMap((entity) => entity.links);

  const expect = async (label: string, written: Promise<number>, wanted: number) => {
    const count = await written;
    console.log(`  ${label}: inserted ${count} of ${wanted}`);
    if (count !== wanted) {
      throw new Error(`${label}: inserted ${count}, planned ${wanted}; rolling back`);
    }
  };

  await expect(
    'source_organizations',
    insertRows(
      client,
      'evidence.source_organizations',
      { id: 'text', name: 'text', homepage: 'text' },
      plan.organizations,
    ),
    plan.organizations.length,
  );
  await expect(
    'source_domains',
    insertRows(
      client,
      'evidence.source_domains',
      { id: 'text', organization_id: 'text', hostname: 'text' },
      plan.domains,
    ),
    plan.domains.length,
  );
  await expect(
    'evidence_sources',
    insertRows(
      client,
      'evidence.evidence_sources',
      {
        id: 'text',
        organization_id: 'text',
        display_name: 'text',
        adapter_id: 'text',
        rights: 'jsonb',
      },
      plan.evidenceSources,
    ),
    plan.evidenceSources.length,
  );
  await expect(
    'source_items',
    insertRows(
      client,
      'evidence.source_items',
      {
        id: 'text',
        source_id: 'text',
        stable_identifier: 'text',
        title: 'text',
        url: 'text',
        metadata: 'jsonb',
      },
      plan.sourceItems,
    ),
    plan.sourceItems.length,
  );
  await expect(
    'evidence_records',
    insertRows(
      client,
      'evidence.evidence_records',
      {
        id: 'text',
        source_item_id: 'text',
        rights_status: 'text',
        excerpt: 'text',
        lineage_root_id: 'text',
        metadata: 'jsonb',
      },
      plan.evidenceRecords,
    ),
    plan.evidenceRecords.length,
  );
  // claims.current_version_id -> claim_versions is DEFERRABLE INITIALLY DEFERRED, so the claim
  // can carry its version id before the version row exists in this transaction.
  await expect(
    'claims',
    insertRows(
      client,
      'canonical.claims',
      {
        id: 'text',
        entity_id: 'text',
        current_version_id: 'text',
        claim_class: 'text',
        workflow_status: 'text',
        publication_status: 'text',
        procedural_status: 'text',
        confidence: 'jsonb',
        research_coverage: 'jsonb',
        verification: 'jsonb',
      },
      claims,
    ),
    claims.length,
  );
  await expect(
    'claim_versions',
    insertRows(
      client,
      'canonical.claim_versions',
      {
        id: 'text',
        claim_id: 'text',
        predicate: 'text',
        object: 'jsonb',
        workflow_status: 'text',
        publication_status: 'text',
        confidence: 'jsonb',
        body: 'jsonb',
        created_by: 'text',
      },
      // object is jsonb; the public string value lands as a JSON string, as convergence stored it.
      versions,
    ),
    versions.length,
  );
  await expect(
    'claim_evidence_links',
    insertRows(
      client,
      'canonical.claim_evidence_links',
      {
        id: 'text',
        claim_id: 'text',
        claim_version_id: 'text',
        evidence_id: 'text',
        role: 'text',
        lineage_root_id: 'text',
        quality: 'jsonb',
        asserted_value: 'jsonb',
      },
      links,
    ),
    links.length,
  );

  const verify = await client.query<{
    entities_still_without_claims: number;
    broken_chains: number;
  }>(
    `
    WITH planned AS (SELECT unnest($1::text[]) AS entity_id)
    SELECT
      (SELECT count(*)::int FROM planned p
        WHERE NOT EXISTS (SELECT 1 FROM canonical.claims c WHERE c.entity_id = p.entity_id)
      ) AS entities_still_without_claims,
      (SELECT count(*)::int FROM canonical.claims c
        JOIN planned p ON p.entity_id = c.entity_id
        WHERE NOT EXISTS (
          SELECT 1
          FROM canonical.claim_versions v
          JOIN canonical.claim_evidence_links l ON l.claim_version_id = v.id
          JOIN evidence.evidence_records er ON er.id = l.evidence_id
          JOIN evidence.source_items si ON si.id = er.source_item_id
          JOIN evidence.evidence_sources es ON es.id = si.source_id
          WHERE v.id = c.current_version_id AND l.claim_id = c.id
        )
      ) AS broken_chains
    `,
    [planned.map((entity) => entity.entityId)],
  );
  const check = verify.rows[0]!;
  console.log(
    `  verify: entities still without claims=${check.entities_still_without_claims}, claims without a full chain=${check.broken_chains}`,
  );
  if (check.entities_still_without_claims !== 0 || check.broken_chains !== 0) {
    throw new Error('Post-write verification failed; rolling back');
  }
}

function printTotals(plan: BackfillPlan): void {
  const t = plan.totals;
  console.log(`=== Canonical claims backfill from release ${plan.releaseId} ===`);
  console.log(`entities in scope:          ${t.entitiesInScope}`);
  console.log(`entities planned / blocked: ${t.entitiesPlanned} / ${t.entitiesBlocked}`);
  console.log(`claims:                     ${t.claims}`);
  console.log(`claim_versions:             ${t.claimVersions}`);
  console.log(`claim_evidence_links:       ${t.links}`);
  console.log(`evidence_records new/reused:  ${t.evidenceRecordsNew} / ${t.evidenceRecordsReused}`);
  console.log(`source_items new/reused:      ${t.sourceItemsNew} / ${t.sourceItemsReused}`);
  console.log(`evidence_sources new/reused:  ${t.evidenceSourcesNew} / ${t.evidenceSourcesReused}`);
  console.log(`organizations new/matched:    ${t.organizationsNew} / ${t.organizationsMatched}`);
  console.log(`source_domains new:           ${t.domainsNew}`);
  console.log(`hosts unmatched (new orgs):   ${t.hostsUnmatched}`);
  console.log(`hosts ambiguous (tie-broken): ${t.hostsAmbiguous}`);
  console.log(`claims resolved via merge:    ${t.claimsResolvedViaMerge}`);
  const blocked = plan.entities.filter((entity) => entity.blocked.length > 0);
  for (const entity of blocked) {
    console.log(`BLOCKED ${entity.entityId} (${entity.kind}): ${entity.blocked.join('; ')}`);
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error('DATABASE_URL (or APP_DATABASE_URL) is required');
    process.exit(2);
  }
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const client = await connectWithDeadline<pg.PoolClient>(pool);
  try {
    await client.query(WRITE ? 'BEGIN' : 'BEGIN READ ONLY');
    try {
      if (WRITE) {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [ADVISORY_LOCK_KEY]);
      }
      const plan = await planWithExistence(client);

      mkdirSync(dirname(PLAN_OUT), { recursive: true });
      writeFileSync(
        PLAN_OUT,
        `${JSON.stringify({ mode: WRITE ? 'apply' : 'dry-run', generatedAt: new Date().toISOString(), ...plan }, null, 2)}\n`,
      );
      printTotals(plan);
      console.log(`plan written to ${PLAN_OUT}`);

      if (!WRITE) {
        await client.query('ROLLBACK');
        console.log(
          'DRY_RUN (default): read-only transaction, no writes. Set DRY_RUN=0 BACKFILL_CANONICAL_CLAIMS_FROM_RELEASE_APPLY=1 to apply.',
        );
        return;
      }
      if (plan.totals.claims === 0) {
        await client.query('ROLLBACK');
        console.log('Nothing to backfill; no writes.');
        return;
      }
      await applyPlan(client, plan);
      await client.query('COMMIT');
      console.log('Committed. published untouched; no catalog republish needed.');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
