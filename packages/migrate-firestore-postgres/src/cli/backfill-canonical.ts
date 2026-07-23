/**
 * Reconcile the active Supabase public release into the normalized canonical/evidence ledger.
 *
 * Dry-run is the default. A hosted write requires both:
 *   --apply --confirm-hosted-write=canonical-convergence
 *
 * The apply path is one repeatable-read transaction protected by an advisory transaction lock.
 * It never changes bb_public.*. Existing curated canonical values win; only demonstrable entity
 * stubs (display_name = id) are upgraded from the public release.
 */
import pg from 'pg';
import {
  buildCanonicalConvergencePlan,
  stableId,
  type ActiveReleaseRow,
  type CanonicalConvergencePlan,
} from '../canonical-convergence.js';
import { normalizePgConnectionString } from '../pg-writer.js';

const APPLY_CONFIRMATION = '--confirm-hosted-write=canonical-convergence';
const BATCH_SIZE = 250;

type Verification = {
  readonly active_release: string;
  readonly public_entities: number;
  readonly missing_canonical_entities: number;
  readonly display_name_mismatches: number;
  readonly kind_mismatches: number;
  readonly missing_canonical_locations: number;
  readonly planned_claims: number;
  readonly missing_planned_claims: number;
  readonly claims_without_current_version: number;
  readonly claims_without_evidence_link: number;
  readonly missing_planned_relationships: number;
};

function requireDatabaseUrl(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

function parseMode(argv: readonly string[]): 'dry-run' | 'apply' {
  const apply = argv.includes('--apply');
  if (apply && !argv.includes(APPLY_CONFIRMATION)) {
    throw new Error(`Hosted apply requires both --apply and ${APPLY_CONFIRMATION}`);
  }
  return apply ? 'apply' : 'dry-run';
}

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

async function loadActiveReleaseRows(client: pg.PoolClient): Promise<ActiveReleaseRow[]> {
  const result = await client.query<
    Omit<ActiveReleaseRow, 'created_at'> & { readonly created_at: Date | string }
  >(`
    SELECT
      re.release_id,
      re.entity_id,
      re.display_name,
      re.kind,
      re.summary,
      re.location,
      re.geohash,
      re.lat,
      re.lng,
      re.claims,
      re.taxonomy,
      re.related,
      re.primary_image,
      re.projection,
      COALESCE(si.aliases, '{}'::text[]) AS search_aliases,
      re.created_at
    FROM bb_public.active_release ar
    JOIN bb_public.release_entities re ON re.release_id = ar.release_id
    LEFT JOIN bb_public.search_index si
      ON si.release_id = re.release_id AND si.entity_id = re.entity_id
    WHERE ar.id = 'active'
    ORDER BY re.entity_id
  `);
  return result.rows.map((row) => ({ ...row, created_at: asIso(row.created_at) }));
}

function planSummary(plan: CanonicalConvergencePlan): Record<string, unknown> {
  return {
    releaseId: plan.releaseId,
    planHash: plan.planHash,
    entities: plan.entities.length,
    locations: plan.locations.length,
    claims: plan.claims.length,
    claimVersions: plan.claimVersions.length,
    sourceOrganizations: plan.sourceOrganizations.length,
    sourceDomains: plan.sourceDomains.length,
    evidenceSources: plan.evidenceSources.length,
    sourceItems: plan.sourceItems.length,
    evidenceRecords: plan.evidenceRecords.length,
    claimEvidenceLinks: plan.claimEvidenceLinks.length,
    relationships: plan.relationships.length,
    warnings: plan.warnings.length,
  };
}

async function assertNoCanonicalConflicts(
  client: pg.PoolClient,
  plan: CanonicalConvergencePlan,
): Promise<{ readonly preservedCuratedEntities: number }> {
  const claimIds = plan.claims.map((claim) => claim.id);
  const claims = await client.query<{
    readonly id: string;
    readonly entity_id: string;
  }>(`SELECT id, entity_id FROM bb_canonical.claims WHERE id = ANY($1::text[])`, [claimIds]);
  const incomingClaims = new Map(plan.claims.map((claim) => [claim.id, claim.entity_id]));
  const conflicts = claims.rows.filter((row) => incomingClaims.get(row.id) !== row.entity_id);
  if (conflicts.length > 0) {
    throw new Error(
      `Canonical claim ownership conflict: ${conflicts
        .slice(0, 10)
        .map((row) => `${row.id} belongs to ${row.entity_id}`)
        .join(', ')}`,
    );
  }

  const entityIds = plan.entities.map((entity) => entity.id);
  const entities = await client.query<{
    readonly id: string;
    readonly display_name: string;
    readonly kind: string;
  }>(
    `SELECT id, display_name, kind
     FROM bb_canonical.entities
     WHERE id = ANY($1::text[])
       AND display_name <> id`,
    [entityIds],
  );
  const incomingEntities = new Map(plan.entities.map((entity) => [entity.id, entity]));
  const preserved = entities.rows.filter((row) => {
    const incoming = incomingEntities.get(row.id);
    return !!incoming && (incoming.display_name !== row.display_name || incoming.kind !== row.kind);
  });
  return { preservedCuratedEntities: preserved.length };
}

async function forEachBatch<T>(
  rows: readonly T[],
  operation: (batch: readonly T[]) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    await operation(rows.slice(index, index + BATCH_SIZE));
  }
}

async function applyPlan(client: pg.PoolClient, plan: CanonicalConvergencePlan): Promise<void> {
  await forEachBatch(plan.entities, async (batch) => {
    await client.query(
      `
        WITH incoming AS (
          SELECT *
          FROM jsonb_to_recordset($1::jsonb) AS x(
            id text,
            kind text,
            entity_class text,
            display_name text,
            aliases jsonb,
            living_status text,
            status_history jsonb,
            notability_basis jsonb,
            sensitivity jsonb,
            kind_detail jsonb,
            created_at timestamptz
          )
        )
        INSERT INTO bb_canonical.entities (
          id, kind, entity_class, display_name, aliases, living_status,
          status_history, notability_basis, sensitivity, kind_detail, created_at, updated_at
        )
        SELECT
          id, kind, entity_class, display_name, aliases, living_status,
          status_history, notability_basis, sensitivity, kind_detail, created_at, now()
        FROM incoming
        ON CONFLICT (id) DO UPDATE SET
          display_name = CASE
            WHEN bb_canonical.entities.display_name = bb_canonical.entities.id
              THEN EXCLUDED.display_name
            ELSE bb_canonical.entities.display_name
          END,
          kind = CASE
            WHEN bb_canonical.entities.display_name = bb_canonical.entities.id
              THEN EXCLUDED.kind
            ELSE bb_canonical.entities.kind
          END,
          entity_class = COALESCE(bb_canonical.entities.entity_class, EXCLUDED.entity_class),
          living_status = CASE
            WHEN bb_canonical.entities.display_name = bb_canonical.entities.id
              THEN EXCLUDED.living_status
            ELSE bb_canonical.entities.living_status
          END,
          aliases = CASE
            WHEN bb_canonical.entities.aliases = '[]'::jsonb THEN EXCLUDED.aliases
            ELSE bb_canonical.entities.aliases
          END,
          status_history = CASE
            WHEN bb_canonical.entities.status_history = '[]'::jsonb THEN EXCLUDED.status_history
            ELSE bb_canonical.entities.status_history
          END,
          notability_basis = CASE
            WHEN bb_canonical.entities.notability_basis = '[]'::jsonb THEN EXCLUDED.notability_basis
            ELSE bb_canonical.entities.notability_basis
          END,
          sensitivity = CASE
            WHEN bb_canonical.entities.sensitivity = '[]'::jsonb THEN EXCLUDED.sensitivity
            ELSE bb_canonical.entities.sensitivity
          END,
          kind_detail = EXCLUDED.kind_detail || bb_canonical.entities.kind_detail,
          updated_at = now()
      `,
      [JSON.stringify(batch)],
    );
  });

  await forEachBatch(plan.locations, async (batch) => {
    await client.query(
      `
        WITH incoming AS (
          SELECT *
          FROM jsonb_to_recordset($1::jsonb) AS x(
            id text,
            entity_id text,
            role text,
            geometry jsonb,
            lat double precision,
            lng double precision,
            geohash text,
            geohash_prefixes jsonb,
            precision text,
            match_method text,
            label text,
            created_at timestamptz
          )
        )
        INSERT INTO bb_canonical.entity_locations (
          id, entity_id, role, geometry_type, geometry, location, lat, lng,
          geohash, geohash_prefixes, precision, match_method, label, created_at, updated_at
        )
        SELECT
          id,
          entity_id,
          role,
          'Point',
          geometry,
          extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography,
          lat,
          lng,
          geohash,
          ARRAY(SELECT jsonb_array_elements_text(geohash_prefixes)),
          precision,
          match_method,
          label,
          created_at,
          now()
        FROM incoming
        ON CONFLICT (id) DO UPDATE SET
          geometry = EXCLUDED.geometry,
          location = EXCLUDED.location,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          geohash = EXCLUDED.geohash,
          geohash_prefixes = EXCLUDED.geohash_prefixes,
          precision = EXCLUDED.precision,
          match_method = EXCLUDED.match_method,
          label = EXCLUDED.label,
          updated_at = now()
      `,
      [JSON.stringify(batch)],
    );
  });

  await forEachBatch(plan.sourceOrganizations, async (batch) => {
    await client.query(
      `
        INSERT INTO bb_evidence.source_organizations (id, name, homepage)
        SELECT id, name, homepage
        FROM jsonb_to_recordset($1::jsonb) AS x(id text, name text, homepage text)
        ON CONFLICT (id) DO NOTHING
      `,
      [JSON.stringify(batch)],
    );
  });
  await forEachBatch(plan.sourceDomains, async (batch) => {
    await client.query(
      `
        INSERT INTO bb_evidence.source_domains (id, organization_id, hostname)
        SELECT id, organization_id, hostname
        FROM jsonb_to_recordset($1::jsonb)
          AS x(id text, organization_id text, hostname text)
        ON CONFLICT (hostname) DO NOTHING
      `,
      [JSON.stringify(batch)],
    );
  });
  await forEachBatch(plan.evidenceSources, async (batch) => {
    await client.query(
      `
        INSERT INTO bb_evidence.evidence_sources (
          id, organization_id, display_name, adapter_id, adapter_enabled, rights
        )
        SELECT id, organization_id, display_name, adapter_id, false, rights
        FROM jsonb_to_recordset($1::jsonb)
          AS x(id text, organization_id text, display_name text, adapter_id text, rights jsonb)
        ON CONFLICT (id) DO NOTHING
      `,
      [JSON.stringify(batch)],
    );
  });
  await forEachBatch(plan.sourceItems, async (batch) => {
    await client.query(
      `
        INSERT INTO bb_evidence.source_items (
          id, source_id, stable_identifier, title, url, metadata
        )
        SELECT id, source_id, stable_identifier, title, url, metadata
        FROM jsonb_to_recordset($1::jsonb) AS x(
          id text,
          source_id text,
          stable_identifier text,
          title text,
          url text,
          metadata jsonb
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [JSON.stringify(batch)],
    );
  });
  await forEachBatch(plan.evidenceRecords, async (batch) => {
    await client.query(
      `
        INSERT INTO bb_evidence.evidence_records (
          id, source_item_id, rights_status, excerpt, lineage_root_id, metadata
        )
        SELECT id, source_item_id, rights_status, excerpt, lineage_root_id, metadata
        FROM jsonb_to_recordset($1::jsonb) AS x(
          id text,
          source_item_id text,
          rights_status text,
          excerpt text,
          lineage_root_id text,
          metadata jsonb
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [JSON.stringify(batch)],
    );
  });

  await forEachBatch(plan.claims, async (batch) => {
    await client.query(
      `
        INSERT INTO bb_canonical.claims (
          id, entity_id, current_version_id, claim_class, workflow_status,
          publication_status, procedural_status, confidence, research_coverage,
          verification, created_at, updated_at
        )
        SELECT
          id, entity_id, NULL, claim_class, workflow_status,
          publication_status, procedural_status, confidence, research_coverage,
          verification, created_at, now()
        FROM jsonb_to_recordset($1::jsonb) AS x(
          id text,
          entity_id text,
          current_version_id text,
          claim_class text,
          workflow_status text,
          publication_status text,
          procedural_status text,
          confidence jsonb,
          research_coverage jsonb,
          verification jsonb,
          created_at timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          claim_class = COALESCE(bb_canonical.claims.claim_class, EXCLUDED.claim_class),
          workflow_status = COALESCE(bb_canonical.claims.workflow_status, EXCLUDED.workflow_status),
          publication_status = COALESCE(
            bb_canonical.claims.publication_status,
            EXCLUDED.publication_status
          ),
          procedural_status = COALESCE(
            bb_canonical.claims.procedural_status,
            EXCLUDED.procedural_status
          ),
          confidence = COALESCE(bb_canonical.claims.confidence, EXCLUDED.confidence),
          research_coverage = COALESCE(
            bb_canonical.claims.research_coverage,
            EXCLUDED.research_coverage
          ),
          verification = COALESCE(bb_canonical.claims.verification, EXCLUDED.verification),
          updated_at = now()
      `,
      [JSON.stringify(batch)],
    );
  });
  await forEachBatch(plan.claimVersions, async (batch) => {
    await client.query(
      `
        INSERT INTO bb_canonical.claim_versions (
          id, claim_id, predicate, object, workflow_status, publication_status,
          confidence, body, created_at, created_by
        )
        SELECT
          id, claim_id, predicate, object, workflow_status, publication_status,
          confidence, body, created_at, created_by
        FROM jsonb_to_recordset($1::jsonb) AS x(
          id text,
          claim_id text,
          predicate text,
          object jsonb,
          workflow_status text,
          publication_status text,
          confidence jsonb,
          body jsonb,
          created_at timestamptz,
          created_by text
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [JSON.stringify(batch)],
    );
  });
  await forEachBatch(plan.claims, async (batch) => {
    await client.query(
      `
        WITH incoming AS (
          SELECT *
          FROM jsonb_to_recordset($1::jsonb) AS x(id text, current_version_id text)
        )
        UPDATE bb_canonical.claims c
        SET current_version_id = incoming.current_version_id, updated_at = now()
        FROM incoming
        WHERE c.id = incoming.id
          AND c.current_version_id IS NULL
      `,
      [JSON.stringify(batch)],
    );
  });
  await forEachBatch(plan.claimEvidenceLinks, async (batch) => {
    await client.query(
      `
        INSERT INTO bb_canonical.claim_evidence_links (
          id, claim_id, claim_version_id, evidence_id, role, lineage_root_id,
          quality, asserted_value
        )
        SELECT
          id, claim_id, claim_version_id, evidence_id, role, lineage_root_id,
          quality, asserted_value
        FROM jsonb_to_recordset($1::jsonb) AS x(
          id text,
          claim_id text,
          claim_version_id text,
          evidence_id text,
          role text,
          lineage_root_id text,
          quality jsonb,
          asserted_value jsonb
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [JSON.stringify(batch)],
    );
  });

  await forEachBatch(plan.relationships, async (batch) => {
    await client.query(
      `
        WITH incoming AS (
          SELECT *
          FROM jsonb_to_recordset($1::jsonb) AS x(
            id text,
            from_entity_id text,
            to_entity_id text,
            relationship_type text,
            valid_from date,
            valid_to date,
            workflow_status text,
            publication_status text,
            confidence jsonb,
            geographic jsonb
          )
        )
        INSERT INTO bb_canonical.entity_relationships (
          id, from_entity_id, to_entity_id, relationship_type,
          valid_from, valid_to, workflow_status, publication_status,
          confidence, geographic
        )
        SELECT
          i.id, i.from_entity_id, i.to_entity_id, i.relationship_type,
          i.valid_from, i.valid_to, i.workflow_status, i.publication_status,
          i.confidence, i.geographic
        FROM incoming i
        WHERE NOT EXISTS (
          SELECT 1
          FROM bb_canonical.entity_relationships existing
          WHERE existing.from_entity_id = i.from_entity_id
            AND existing.to_entity_id = i.to_entity_id
            AND existing.relationship_type = i.relationship_type
            AND existing.valid_from IS NOT DISTINCT FROM i.valid_from
            AND existing.valid_to IS NOT DISTINCT FROM i.valid_to
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [JSON.stringify(batch)],
    );
  });
}

async function verifyPlan(
  client: pg.PoolClient,
  plan: CanonicalConvergencePlan,
): Promise<Verification> {
  const claimIds = plan.claims.map((claim) => claim.id);
  const relationshipsJson = JSON.stringify(plan.relationships);
  const result = await client.query<Verification>(
    `
      WITH active AS (
        SELECT release_id FROM bb_public.active_release WHERE id = 'active'
      ),
      public_entities AS (
        SELECT re.*
        FROM bb_public.release_entities re, active
        WHERE re.release_id = active.release_id
      ),
      planned_claims AS (
        SELECT unnest($1::text[]) AS id
      ),
      planned_relationships AS (
        SELECT *
        FROM jsonb_to_recordset($2::jsonb) AS x(
          from_entity_id text,
          to_entity_id text,
          relationship_type text,
          valid_from date,
          valid_to date
        )
      )
      SELECT
        (SELECT release_id FROM active) AS active_release,
        (SELECT count(*)::int FROM public_entities) AS public_entities,
        (
          SELECT count(*)::int
          FROM public_entities p
          LEFT JOIN bb_canonical.entities e ON e.id = p.entity_id
          WHERE e.id IS NULL
        ) AS missing_canonical_entities,
        (
          SELECT count(*)::int
          FROM public_entities p
          JOIN bb_canonical.entities e ON e.id = p.entity_id
          WHERE e.display_name IS DISTINCT FROM p.display_name
        ) AS display_name_mismatches,
        (
          SELECT count(*)::int
          FROM public_entities p
          JOIN bb_canonical.entities e ON e.id = p.entity_id
          WHERE e.kind IS DISTINCT FROM p.kind
        ) AS kind_mismatches,
        (
          SELECT count(*)::int
          FROM public_entities p
          WHERE NOT EXISTS (
            SELECT 1
            FROM bb_canonical.entity_locations l
            WHERE l.entity_id = p.entity_id
              AND l.lat IS NOT NULL
              AND l.lng IS NOT NULL
          )
        ) AS missing_canonical_locations,
        (SELECT count(*)::int FROM planned_claims) AS planned_claims,
        (
          SELECT count(*)::int
          FROM planned_claims p
          LEFT JOIN bb_canonical.claims c ON c.id = p.id
          WHERE c.id IS NULL
        ) AS missing_planned_claims,
        (
          SELECT count(*)::int
          FROM planned_claims p
          JOIN bb_canonical.claims c ON c.id = p.id
          WHERE c.current_version_id IS NULL
             OR NOT EXISTS (
               SELECT 1 FROM bb_canonical.claim_versions v
               WHERE v.id = c.current_version_id AND v.claim_id = c.id
             )
        ) AS claims_without_current_version,
        (
          SELECT count(*)::int
          FROM planned_claims p
          JOIN bb_canonical.claims c ON c.id = p.id
          WHERE NOT EXISTS (
            SELECT 1
            FROM bb_canonical.claim_evidence_links link
            WHERE link.claim_id = c.id
              AND link.claim_version_id = c.current_version_id
              AND link.role = 'supporting'
          )
        ) AS claims_without_evidence_link,
        (
          SELECT count(*)::int
          FROM planned_relationships p
          WHERE NOT EXISTS (
            SELECT 1
            FROM bb_canonical.entity_relationships r
            WHERE r.from_entity_id = p.from_entity_id
              AND r.to_entity_id = p.to_entity_id
              AND r.relationship_type = p.relationship_type
              AND r.valid_from IS NOT DISTINCT FROM p.valid_from
              AND r.valid_to IS NOT DISTINCT FROM p.valid_to
          )
        ) AS missing_planned_relationships
    `,
    [claimIds, relationshipsJson],
  );
  const verification = result.rows[0];
  if (!verification) throw new Error('Convergence verification returned no row');
  return verification;
}

function assertVerified(verification: Verification): void {
  const failures = [
    ['missing_canonical_entities', verification.missing_canonical_entities],
    ['display_name_mismatches', verification.display_name_mismatches],
    ['kind_mismatches', verification.kind_mismatches],
    ['missing_canonical_locations', verification.missing_canonical_locations],
    ['missing_planned_claims', verification.missing_planned_claims],
    ['claims_without_current_version', verification.claims_without_current_version],
    ['claims_without_evidence_link', verification.claims_without_evidence_link],
    ['missing_planned_relationships', verification.missing_planned_relationships],
  ].filter(([, count]) => count !== 0);
  if (failures.length > 0) {
    throw new Error(
      `Canonical convergence verification failed: ${failures
        .map(([name, count]) => `${name}=${count}`)
        .join(', ')}`,
    );
  }
}

async function insertAuditEvent(
  client: pg.PoolClient,
  plan: CanonicalConvergencePlan,
  verification: Verification,
): Promise<void> {
  const idempotencyKey = `canonical-convergence:${plan.releaseId}:${plan.planHash}`;
  const eventId = stableId('audit', idempotencyKey);
  await client.query(
    `
      INSERT INTO bb_audit.events (
        id, action, category, actor, subject, reason, request_id, correlation_id,
        release_id, idempotency_key, occurred_at, data
      )
      VALUES (
        $1,
        'canonical.active_release_backfilled',
        'canonical',
        $2::jsonb,
        $3::jsonb,
        'Backfilled the active public release into normalized canonical and evidence tables',
        $4,
        $4,
        $5,
        $6,
        now(),
        $7::jsonb
      )
      ON CONFLICT (id) DO NOTHING
    `,
    [
      eventId,
      JSON.stringify({ id: 'canonical-convergence', type: 'service' }),
      JSON.stringify({ type: 'release', id: plan.releaseId }),
      eventId,
      plan.releaseId,
      idempotencyKey,
      JSON.stringify({ plan: planSummary(plan), verification }),
    ],
  );
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  const connection = normalizePgConnectionString(requireDatabaseUrl());
  const pool = new pg.Pool({
    connectionString: connection.connectionString,
    max: 1,
    ...(connection.ssl ? { ssl: connection.ssl } : {}),
  });
  const client = await pool.connect();
  let plan: CanonicalConvergencePlan | undefined;

  try {
    await client.query(
      mode === 'apply'
        ? 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ'
        : 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
    if (mode === 'apply') {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtext('blackstory-canonical-convergence'))`,
      );
    }
    const rows = await loadActiveReleaseRows(client);
    plan = buildCanonicalConvergencePlan(rows);
    const preflight = await assertNoCanonicalConflicts(client, plan);
    const before = await verifyPlan(client, plan);
    console.log(JSON.stringify({ mode, plan: planSummary(plan), preflight, before }, null, 2));
    if (plan.warnings.length > 0) {
      console.log(JSON.stringify({ warnings: plan.warnings }, null, 2));
    }

    if (mode === 'dry-run') {
      await client.query('ROLLBACK');
      console.log(
        `Dry-run only. Re-run with --apply ${APPLY_CONFIRMATION} to perform the hosted transaction.`,
      );
      return;
    }

    await applyPlan(client, plan);
    const after = await verifyPlan(client, plan);
    assertVerified(after);
    await insertAuditEvent(client, plan, after);
    await client.query('COMMIT');
    console.log(JSON.stringify({ applied: true, after }, null, 2));
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original failure.
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
