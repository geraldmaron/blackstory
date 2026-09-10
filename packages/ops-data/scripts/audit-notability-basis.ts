/**
 * Measures how the published `notabilityBasis` actually answers "why is this record here",
 * across the whole active release.
 *
 * The question this exists to keep answerable: `NOTABILITY_CRITERIA` is a closed rubric
 * vocabulary whose text is public methodology, but nothing measures whether the published data
 * uses it. It did not: on rel_20260723_authority_net_001, 63% of every basis record in the
 * catalog carried the one criterion that is reachable only as a fallback, and every criterion
 * whose ratified text names several entity kinds was in use on exactly one kind — usually not
 * one its text describes. See docs/methodology/notability-rubric.md.
 *
 * Reports four things:
 *   1. criterion x kind cross-tab — catches a criterion applied to a kind its text does not cover
 *   2. records whose ONLY stated reason is `documented_site` — these have no honest basis at all
 *   3. the claim predicates behind those basis records — shows whether a keyword ladder can reach
 *      them (it cannot: 847 distinct predicates produce 1,654 non-place basis records)
 *   4. per-kind note openings with examples, for reading the cohorts by hand
 *
 * Read-only. Writes nothing.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/audit-notability-basis.ts [kind ...]
 *
 * With no arguments it reports every kind. Naming kinds limits sections 2 and 4 to those kinds.
 */
import pg from 'pg';
import { NOTABILITY_CRITERIA, type NotabilityBasisRecord } from '@repo/domain';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const FALLBACK_CRITERION = 'documented_site';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

type Row = {
  readonly entity_id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly claims: readonly { predicate?: string; object?: string }[] | null;
  readonly projection: { notabilityBasis?: readonly NotabilityBasisRecord[] } | null;
};

function bump<K>(map: Map<K, number>, key: K): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function nested<K>(map: Map<string, Map<K, number>>, outer: string, key: K): void {
  const inner = map.get(outer) ?? new Map<K, number>();
  bump(inner, key);
  map.set(outer, inner);
}

/** First two words of a basis note — the cohort signal, since notes lead with the predicate. */
function noteOpening(note: string): string {
  return note.trim().split(/\s+/u).slice(0, 2).join(' ').replace(/[.,]$/u, '');
}

async function main(): Promise<void> {
  const kindFilter = new Set(process.argv.slice(2));
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const active = await client.query<{ release_id: string }>(
      `SELECT release_id FROM bb_public.v_active_release_id`,
    );
    const releaseId = active.rows[0]?.release_id;
    if (!releaseId) throw new Error('No active release');

    const { rows } = await client.query<Row>(
      `SELECT entity_id, display_name, kind, claims, projection
         FROM bb_public.release_entities WHERE release_id = $1 ORDER BY kind, display_name`,
      [releaseId],
    );

    const crossTab = new Map<string, Map<string, number>>();
    const fallbackOnly = new Map<string, string[]>();
    const predicates = new Map<string, number>();
    const openings = new Map<string, Map<string, number>>();
    const examples = new Map<string, string[]>();
    let totalBasis = 0;
    let totalFallback = 0;

    for (const row of rows) {
      const basis = row.projection?.notabilityBasis ?? [];
      totalBasis += basis.length;
      for (const record of basis) nested(crossTab, record.criterion, row.kind);

      const fallbacks = basis.filter((record) => record.criterion === FALLBACK_CRITERION);
      if (fallbacks.length === 0) continue;
      totalFallback += fallbacks.length;

      if (fallbacks.length === basis.length) {
        const list = fallbackOnly.get(row.kind) ?? [];
        list.push(row.display_name);
        fallbackOnly.set(row.kind, list);
      }

      // Recover the claim predicate each basis record was built from. `buildNotabilityBasisNote`
      // leads the note with the sentence-cased predicate, so the note prefix identifies it.
      const rowPredicates = [
        ...new Set((row.claims ?? []).map((claim) => claim.predicate).filter(Boolean)),
      ] as string[];
      for (const record of fallbacks) {
        const lead = record.note.split(/\s+/u).slice(0, 4).join(' ').toLowerCase();
        const matched = rowPredicates.find((predicate) =>
          lead.startsWith(
            predicate.replaceAll('_', ' ').toLowerCase().slice(0, Math.min(predicate.length, 18)),
          ),
        );
        bump(predicates, matched ?? `(unmatched) ${noteOpening(record.note).toLowerCase()}`);

        const opening = noteOpening(record.note);
        nested(openings, row.kind, opening);
        const key = `${row.kind}|${opening}`;
        const seen = examples.get(key) ?? [];
        if (seen.length < 3) {
          seen.push(`${row.display_name} :: ${record.note}`);
          examples.set(key, seen);
        }
      }
    }

    const pct = totalBasis > 0 ? ((totalFallback / totalBasis) * 100).toFixed(1) : '0.0';
    console.log(`release ${releaseId} — ${rows.length} records, ${totalBasis} basis records`);
    console.log(`${FALLBACK_CRITERION}: ${totalFallback} (${pct}% of every basis record)`);

    console.log('\n== 1. criterion x kind ==');
    for (const criterion of NOTABILITY_CRITERIA) {
      const kinds = crossTab.get(criterion);
      if (!kinds) {
        console.log(`  ${criterion}: UNUSED`);
        continue;
      }
      const detail = [...kinds.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([kind, count]) => `${kind}=${count}`)
        .join(' ');
      console.log(`  ${criterion}: ${detail}`);
    }

    console.log(`\n== 2. records whose ONLY stated reason is ${FALLBACK_CRITERION} ==`);
    for (const [kind, names] of [...fallbackOnly.entries()].sort(
      (a, b) => b[1].length - a[1].length,
    )) {
      console.log(`  ${kind.padEnd(14)} ${names.length}`);
      if (kindFilter.size > 0 && kindFilter.has(kind)) console.log(`      ${names.join(' · ')}`);
    }

    console.log('\n== 3. claim predicates behind those basis records ==');
    console.log(`  ${predicates.size} distinct predicates for ${totalFallback} basis records`);
    for (const [predicate, count] of [...predicates.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)) {
      console.log(`  ${String(count).padStart(5)}  ${predicate}`);
    }

    if (kindFilter.size > 0) {
      console.log('\n== 4. note openings ==');
      for (const [kind, counts] of [...openings.entries()].sort()) {
        if (!kindFilter.has(kind)) continue;
        console.log(`\n-- ${kind} --`);
        for (const [opening, count] of [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 25)) {
          console.log(`  ${String(count).padStart(4)}  ${opening}`);
          for (const example of examples.get(`${kind}|${opening}`) ?? []) {
            console.log(`          ${example.slice(0, 150)}`);
          }
        }
      }
    }
  } finally {
    await client.end();
  }
}

await main();
