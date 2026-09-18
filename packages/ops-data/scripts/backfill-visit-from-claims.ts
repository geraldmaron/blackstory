/**
 * Derives visit contacts from current claim versions and retains every contributing claim id in
 * source_ids. Official website, visitor phone and public hours predicates take precedence
 * deterministically. Leaves visitability unset; publication still requires an eligible
 * visitability decision.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_VISIT_FROM_CLAIMS_APPLY === '1';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const REPORT_DIR = join(REPO_ROOT, '.cache/landscape-intake/visit-from-claims');

const WEBSITE_PREDICATES = [
  'official_website',
  'officialwebsite',
  'visitor_website',
  'visitorwebsite',
];
const PHONE_PREDICATES = ['visitor_phone', 'visitorphone', 'public_phone'];
const HOURS_PREDICATES = [
  'public_hours',
  'publichours',
  'visitor_hours',
  'visitorhours',
  'hours_note',
];

type ClaimRow = {
  readonly entity_id: string;
  readonly claim_id: string;
  readonly predicate: string;
  readonly object: unknown;
};

type NormalizedClaim = {
  readonly entityId: string;
  readonly claimId: string;
  readonly predicate: string;
  readonly object: string;
};

type VisitPlanRow = {
  readonly entityId: string;
  readonly website?: string;
  readonly websiteSourceId?: string;
  readonly phoneDisplay?: string;
  readonly phoneSourceId?: string;
  readonly hours?: string;
  readonly hoursSourceId?: string;
  readonly sourceIds: readonly string[];
};

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

function normalizeObject(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim();
  if (raw === null || raw === undefined) return '';
  return JSON.stringify(raw).trim();
}

async function loadVisitClaims(client: pg.Client): Promise<readonly NormalizedClaim[]> {
  const allPredicates = [...WEBSITE_PREDICATES, ...PHONE_PREDICATES, ...HOURS_PREDICATES];
  const { rows } = await client.query<ClaimRow>(
    `SELECT c.entity_id, c.id AS claim_id, v.predicate, v.object
     FROM canonical.claims c
     JOIN canonical.claim_versions v ON v.id = c.current_version_id
     WHERE c.current_version_id IS NOT NULL
       AND lower(v.predicate) = ANY($1::text[])`,
    [allPredicates],
  );
  return rows
    .map((row) => ({
      entityId: row.entity_id,
      claimId: row.claim_id,
      predicate: row.predicate,
      object: normalizeObject(row.object),
    }))
    .filter((row) => row.object.length > 0);
}

/** First predicate in `preference` order with a non-empty claim object; ties break by claim id. */
function pickByPredicatePreference(
  claims: readonly NormalizedClaim[],
  preference: readonly string[],
): NormalizedClaim | undefined {
  for (const predicate of preference) {
    const matches = claims
      .filter((claim) => claim.predicate.toLowerCase() === predicate)
      .sort((a, b) => a.claimId.localeCompare(b.claimId));
    if (matches.length > 0) return matches[0];
  }
  return undefined;
}

export function planVisitFromClaims(claims: readonly NormalizedClaim[]): readonly VisitPlanRow[] {
  const byEntity = new Map<string, NormalizedClaim[]>();
  for (const claim of claims) {
    const list = byEntity.get(claim.entityId) ?? [];
    list.push(claim);
    byEntity.set(claim.entityId, list);
  }

  const plan: VisitPlanRow[] = [];
  for (const [entityId, entityClaims] of [...byEntity.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const website = pickByPredicatePreference(entityClaims, WEBSITE_PREDICATES);
    const phone = pickByPredicatePreference(entityClaims, PHONE_PREDICATES);
    const hours = pickByPredicatePreference(entityClaims, HOURS_PREDICATES);
    if (!website && !phone && !hours) continue;

    const sourceIds = [...new Set([website, phone, hours].filter(Boolean).map((c) => c!.claimId))];
    plan.push({
      entityId,
      ...(website !== undefined
        ? { website: website.object, websiteSourceId: website.claimId }
        : {}),
      ...(phone !== undefined ? { phoneDisplay: phone.object, phoneSourceId: phone.claimId } : {}),
      ...(hours !== undefined ? { hours: hours.object, hoursSourceId: hours.claimId } : {}),
      sourceIds,
    });
  }
  return plan;
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const claims = await loadVisitClaims(client);
    console.log('=== Backfill entity_visit from claim predicates ===');
    console.log(`Visit-contact claims found (current versions): ${claims.length}`);

    const plan = planVisitFromClaims(claims);
    const counts = {
      totalEntities: plan.length,
      withWebsite: plan.filter((row) => row.website !== undefined).length,
      withPhone: plan.filter((row) => row.phoneDisplay !== undefined).length,
      withHours: plan.filter((row) => row.hours !== undefined).length,
    };
    console.log('Plan counts:', counts);
    console.log('\nSample plan rows:');
    console.table(plan.slice(0, 5));

    mkdirSync(REPORT_DIR, { recursive: true });
    const generatedAt = new Date().toISOString();
    const reportPath = join(REPORT_DIR, `plan-${generatedAt.replace(/[:.]/gu, '-')}.json`);
    writeFileSync(
      reportPath,
      JSON.stringify({ generatedAt, dryRun: DRY_RUN || !APPLY, counts, plan }, null, 2),
    );
    console.log(`\nReport written to ${reportPath}`);

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 BACKFILL_VISIT_FROM_CLAIMS_APPLY=1 to apply.',
      );
      return;
    }

    await client.query('BEGIN');
    try {
      for (const row of plan) {
        await client.query(
          `INSERT INTO canonical.entity_visit
             (entity_id, phone_display, website, hours, source_ids, updated_at)
           VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT (entity_id) DO UPDATE SET
             phone_display = COALESCE(EXCLUDED.phone_display, canonical.entity_visit.phone_display),
             website = COALESCE(EXCLUDED.website, canonical.entity_visit.website),
             hours = COALESCE(EXCLUDED.hours, canonical.entity_visit.hours),
             source_ids = (
               SELECT array_agg(DISTINCT id) FROM unnest(
                 canonical.entity_visit.source_ids || EXCLUDED.source_ids
               ) AS id
             ),
             updated_at = now()`,
          [
            row.entityId,
            row.phoneDisplay ?? null,
            row.website ?? null,
            row.hours ?? null,
            row.sourceIds,
          ],
        );
      }
      await client.query('COMMIT');
      console.log(`\nApplied ${plan.length} entity_visit upserts.`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    await client.end();
  }
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
