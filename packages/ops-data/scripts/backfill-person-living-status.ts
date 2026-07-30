/**
 * Deterministic person living-status backfill: death claims, death qualifiers, WP:BDP.
 * Writes living_status_derived then promotes living_status with provenance.
 *
 * Default dry-run. Apply:
 *   DRY_RUN=0 BACKFILL_PERSON_LIVING_STATUS_APPLY=1
 *
 * Usage:
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-person-living-status.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  derivePersonLivingStatusDeterministic,
  type LivingStatusDerivedRecord,
  type PersonClaimRow,
  type PersonQualifierRow,
} from './lib/status-backfill.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_PERSON_LIVING_STATUS_APPLY === '1';

type PersonRow = {
  readonly id: string;
  readonly display_name: string;
  readonly living_status: string;
  readonly kind_detail: Record<string, unknown>;
};

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

function readBirthYear(kindDetail: Record<string, unknown>): number | null {
  const person = kindDetail.person;
  if (person && typeof person === 'object' && 'birthYear' in person) {
    const year = Number((person as { birthYear?: unknown }).birthYear);
    if (Number.isFinite(year)) return year;
  }
  const top = Number(kindDetail.birthYear);
  return Number.isFinite(top) ? top : null;
}

function readDeathEdtf(kindDetail: Record<string, unknown>): string | null {
  const edtf = kindDetail.death_edtf;
  return typeof edtf === 'string' && edtf.trim() ? edtf.trim() : null;
}

async function loadPersonClaims(client: pg.Client): Promise<Map<string, PersonClaimRow[]>> {
  const { rows } = await client.query<{
    entity_id: string;
    claim_id: string;
    predicate: string;
    object: unknown;
  }>(
    `SELECT c.entity_id, c.id AS claim_id, v.predicate, v.object
     FROM bb_canonical.claims c
     JOIN bb_canonical.claim_versions v ON v.id = c.current_version_id
     JOIN bb_canonical.entities e ON e.id = c.entity_id
     WHERE e.kind = 'person' AND c.current_version_id IS NOT NULL`,
  );
  const map = new Map<string, PersonClaimRow[]>();
  for (const row of rows) {
    const object =
      typeof row.object === 'string'
        ? row.object
        : row.object === null || row.object === undefined
          ? ''
          : JSON.stringify(row.object);
    const list = map.get(row.entity_id) ?? [];
    list.push({ claimId: row.claim_id, predicate: row.predicate, object });
    map.set(row.entity_id, list);
  }
  return map;
}

async function loadPersonQualifiers(client: pg.Client): Promise<Map<string, PersonQualifierRow[]>> {
  const { rows } = await client.query<{
    entity_id: string;
    claim_id: string;
    predicate: string;
    property: string;
    value: { edtf?: string };
  }>(
    `SELECT c.entity_id, c.id AS claim_id, v.predicate, q.property, q.value
     FROM bb_canonical.claim_qualifiers q
     JOIN bb_canonical.claim_versions v ON v.id = q.claim_version_id
     JOIN bb_canonical.claims c ON c.id = v.claim_id
     JOIN bb_canonical.entities e ON e.id = c.entity_id
     WHERE e.kind = 'person' AND q.qualifier_type = 'temporal'`,
  );
  const map = new Map<string, PersonQualifierRow[]>();
  for (const row of rows) {
    const list = map.get(row.entity_id) ?? [];
    list.push({
      claimId: row.claim_id,
      predicate: row.predicate,
      property: row.property,
      edtf: row.value?.edtf ?? null,
    });
    map.set(row.entity_id, list);
  }
  return map;
}

function shouldPromote(derived: LivingStatusDerivedRecord, current: string): boolean {
  if (derived.signal === 'no_signal') return false;
  if (derived.status === 'unknown') return false;
  return current !== derived.status;
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const before = await client.query<{ derived: string; promote: string; deceased_gap: string }>(
      `SELECT
         count(*) FILTER (WHERE living_status_derived IS NOT NULL)::text AS derived,
         count(*) FILTER (WHERE kind = 'person' AND living_status IN ('deceased', 'presumed_deceased'))::text AS promote,
         count(*) FILTER (
           WHERE kind = 'person'
             AND living_status NOT IN ('deceased', 'presumed_deceased')
             AND EXISTS (
               SELECT 1 FROM bb_canonical.claims c
               JOIN bb_canonical.claim_versions v ON v.id = c.current_version_id
               WHERE c.entity_id = e.id
                 AND v.predicate ~* '(lynch|killed|died|death|assassinat|hanged|buried|date_of_death)'
             )
         )::text AS deceased_gap
       FROM bb_canonical.entities e`,
    );

    const persons = await client.query<PersonRow>(
      `SELECT id, display_name, living_status, kind_detail
       FROM bb_canonical.entities
       WHERE kind = 'person'
       ORDER BY id`,
    );
    const claimsByPerson = await loadPersonClaims(client);
    const qualifiersByPerson = await loadPersonQualifiers(client);

    const plans: Array<{
      row: PersonRow;
      derived: LivingStatusDerivedRecord;
      promote: boolean;
    }> = [];

    for (const row of persons.rows) {
      const kindDetail = row.kind_detail ?? {};
      const derived = derivePersonLivingStatusDeterministic({
        claims: claimsByPerson.get(row.id) ?? [],
        qualifiers: qualifiersByPerson.get(row.id) ?? [],
        kindDetailBirthYear: readBirthYear(kindDetail),
        kindDetailDeathEdtf: readDeathEdtf(kindDetail),
      });
      plans.push({
        row,
        derived,
        promote: shouldPromote(derived, row.living_status),
      });
    }

    const withSignal = plans.filter((p) => p.derived.signal !== 'no_signal');
    const toPromote = plans.filter((p) => p.promote);

    console.log('=== backfill-person-living-status ===');
    console.log(`persons: ${persons.rowCount}`);
    console.log(`before derived non-null: ${before.rows[0]?.derived ?? '0'}`);
    console.log(`before deceased+presumed: ${before.rows[0]?.promote ?? '0'}`);
    console.log(`before death-claim gap:    ${before.rows[0]?.deceased_gap ?? '0'}`);
    console.log(`with deterministic signal: ${withSignal.length}`);
    console.log(`would promote living_status: ${toPromote.length}`);

    for (const plan of toPromote) {
      console.log(
        `  ${plan.row.id} (${plan.row.display_name}): ${plan.row.living_status} -> ${plan.derived.status} [${plan.derived.signal}]`,
      );
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDry run only. Set DRY_RUN=0 BACKFILL_PERSON_LIVING_STATUS_APPLY=1 to apply.',
      );
      return;
    }

    let derivedWritten = 0;
    let promoted = 0;
    await client.query('BEGIN');
    try {
      for (const plan of plans) {
        await client.query(
          `UPDATE bb_canonical.entities
           SET living_status_derived = $2::jsonb, updated_at = now()
           WHERE id = $1`,
          [plan.row.id, JSON.stringify(plan.derived)],
        );
        derivedWritten += 1;

        if (!plan.promote) continue;

        const kindDetail = { ...(plan.row.kind_detail ?? {}) };
        if (plan.derived.deathEdtf) {
          kindDetail.death_edtf = plan.derived.deathEdtf;
        }

        await client.query(
          `UPDATE bb_canonical.entities
           SET living_status = $2,
               kind_detail = $3::jsonb,
               updated_at = now()
           WHERE id = $1`,
          [plan.row.id, plan.derived.status, JSON.stringify(kindDetail)],
        );
        promoted += 1;
        console.log(`  applied ${plan.row.id} -> ${plan.derived.status}`);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const after = await client.query<{ derived: string; promote: string; deceased_gap: string }>(
      `SELECT
         count(*) FILTER (WHERE living_status_derived IS NOT NULL)::text AS derived,
         count(*) FILTER (WHERE kind = 'person' AND living_status IN ('deceased', 'presumed_deceased'))::text AS promote,
         count(*) FILTER (
           WHERE kind = 'person'
             AND living_status NOT IN ('deceased', 'presumed_deceased')
             AND EXISTS (
               SELECT 1 FROM bb_canonical.claims c
               JOIN bb_canonical.claim_versions v ON v.id = c.current_version_id
               WHERE c.entity_id = e.id
                 AND v.predicate ~* '(lynch|killed|died|death|assassinat|hanged|buried|date_of_death)'
             )
         )::text AS deceased_gap
       FROM bb_canonical.entities e`,
    );

    console.log(`\nApplied: living_status_derived on ${derivedWritten}, promoted ${promoted}.`);
    console.log(`after derived non-null: ${after.rows[0]?.derived ?? '0'}`);
    console.log(`after deceased+presumed: ${after.rows[0]?.promote ?? '0'}`);
    console.log(`after death-claim gap:    ${after.rows[0]?.deceased_gap ?? '0'}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
