/**
 * Stage 1 — deterministic promotion of clean claim-object dates into claim_qualifiers.
 *
 * Targets current claim versions only (claims.current_version_id join). Parses bare years,
 * ISO dates, and "Month DD, YYYY" objects plus founding-family predicates with year objects.
 * Does not run LLM extraction (Stage 2).
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 PROMOTE_CLAIM_DATE_QUALIFIERS_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/promote-claim-date-qualifiers.ts
 */
import { createHash } from 'node:crypto';
import pg from 'pg';
import { buildClaimTemporalQualifierDraft } from '../../domain/src/temporal/claim-date.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.PROMOTE_CLAIM_DATE_QUALIFIERS_APPLY === '1';

type ClaimRow = {
  readonly claim_id: string;
  readonly claim_version_id: string;
  readonly entity_id: string;
  readonly predicate: string;
  readonly object: string;
};

type PromotionPlanRow = {
  readonly id: string;
  readonly claimId: string;
  readonly claimVersionId: string;
  readonly entityId: string;
  readonly predicate: string;
  readonly object: string;
  readonly property: string;
  readonly value: Record<string, unknown>;
};

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

function qualifierId(claimVersionId: string, property: string): string {
  const digest = createHash('sha256')
    .update(`${claimVersionId}|temporal|${property}`)
    .digest('hex');
  return `cq_${digest.slice(0, 24)}`;
}

async function loadCurrentClaims(client: pg.PoolClient): Promise<readonly ClaimRow[]> {
  const result = await client.query<{
    claim_id: string;
    claim_version_id: string;
    entity_id: string;
    predicate: string;
    object: unknown;
  }>(
    `SELECT
       c.id AS claim_id,
       v.id AS claim_version_id,
       c.entity_id,
       v.predicate,
       v.object
     FROM bb_canonical.claims c
     JOIN bb_canonical.claim_versions v ON v.id = c.current_version_id
     WHERE c.current_version_id IS NOT NULL`,
  );
  return result.rows.map((row) => ({
    claim_id: row.claim_id,
    claim_version_id: row.claim_version_id,
    entity_id: row.entity_id,
    predicate: row.predicate,
    object: typeof row.object === 'string' ? row.object : JSON.stringify(row.object),
  }));
}

async function loadExistingQualifierKeys(client: pg.PoolClient): Promise<ReadonlySet<string>> {
  const result = await client.query<{ claim_version_id: string; property: string }>(
    `SELECT claim_version_id, property
     FROM bb_canonical.claim_qualifiers
     WHERE qualifier_type = 'temporal'`,
  );
  return new Set(result.rows.map((row) => `${row.claim_version_id}|${row.property}`));
}

function planPromotions(
  claims: readonly ClaimRow[],
  existingKeys: ReadonlySet<string>,
): readonly PromotionPlanRow[] {
  const planned: PromotionPlanRow[] = [];
  for (const claim of claims) {
    const draft = buildClaimTemporalQualifierDraft(claim.predicate, claim.object);
    if (!draft) continue;
    const key = `${claim.claim_version_id}|${draft.property}`;
    if (existingKeys.has(key)) continue;
    planned.push({
      id: qualifierId(claim.claim_version_id, draft.property),
      claimId: claim.claim_id,
      claimVersionId: claim.claim_version_id,
      entityId: claim.entity_id,
      predicate: claim.predicate,
      object: claim.object,
      property: draft.property,
      value: draft.value,
    });
  }
  return planned;
}

async function applyPromotions(
  client: pg.PoolClient,
  rows: readonly PromotionPlanRow[],
): Promise<number> {
  let inserted = 0;
  for (const row of rows) {
    const result = await client.query(
      `INSERT INTO bb_canonical.claim_qualifiers (
         id, claim_version_id, qualifier_type, property, value
       ) VALUES ($1, $2, 'temporal', $3, $4::jsonb)
       ON CONFLICT (claim_version_id, qualifier_type, property) DO NOTHING`,
      [row.id, row.claimVersionId, row.property, JSON.stringify(row.value)],
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const pool = new pg.Pool({ connectionString: cs, ssl });
  const client = await pool.connect();
  try {
    const claims = await loadCurrentClaims(client);
    const existingKeys = await loadExistingQualifierKeys(client);
    const plan = planPromotions(claims, existingKeys);

    const byProperty = plan.reduce<Record<string, number>>((acc, row) => {
      acc[row.property] = (acc[row.property] ?? 0) + 1;
      return acc;
    }, {});

    console.log('=== Stage 1 claim date qualifier promotion ===');
    console.log(`Current claims scanned: ${claims.length}`);
    console.log(`Existing temporal qualifiers: ${existingKeys.size}`);
    console.log(`Planned inserts: ${plan.length}`);
    console.log(`By property: ${JSON.stringify(byProperty)}`);

    for (const row of plan.slice(0, 5)) {
      console.log(
        `  ${row.claimId} (${row.predicate} -> ${row.object}): ${row.property} edtf=${String(row.value.edtf)}`,
      );
    }
    if (plan.length > 5) console.log(`  ...and ${plan.length - 5} more`);

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDry run only — no writes made. Set DRY_RUN=0 and PROMOTE_CLAIM_DATE_QUALIFIERS_APPLY=1 to apply.',
      );
      return;
    }

    await client.query('BEGIN');
    try {
      const inserted = await applyPromotions(client, plan);
      await client.query('COMMIT');
      console.log(`\nApplied: inserted ${inserted} claim_qualifiers rows.`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
