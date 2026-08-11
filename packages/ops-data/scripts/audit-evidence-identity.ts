/**
 * repo-ppeu — re-adjudicate already-captured evidence against the tightened identity gate.
 *
 * The gate in subject-identity.ts stops NEW mismatches at capture. It does nothing about the rows
 * captured under the old place-only check, which is most of the corpus: as of 2026-08-10 that is
 * 634 wikipedia rows and 485 reference-hop rows, and the measured mismatch rate in a hand-read
 * sample of 24 subjects was 37.5%. Those rows are live inputs — the drafting harness reads
 * status='captured' and the publish bridge cites it — so leaving them is not neutral.
 *
 * Identity is a pure function of the stored text plus the roster row, so this needs no refetching:
 * it replays `checkSubjectIdentity` over `content_text` exactly as the collector would now.
 *
 * Two collectors are deliberately NOT audited:
 *   - nrhp-nomination: addressed by refnum, and already gated by checkNominationIdentity.
 *   - dc-hpo / person-wikipedia: identity anchored by the row's own canonicalUrl, not by search.
 *     Re-deriving identity from text would wrongly quarantine person rows, which carry no
 *     city/county/state to corroborate against at all.
 *
 * Default is dry-run. Writes require:
 *   DRY_RUN=0 AUDIT_EVIDENCE_IDENTITY_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/audit-evidence-identity.ts [--lanes=nrhp-black-heritage] [--samples=12]
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { checkSubjectIdentity } from './lib/evidence-collectors/subject-identity.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.AUDIT_EVIDENCE_IDENTITY_APPLY === '1';

/** Collectors whose documents were found by SEARCH, and so were only as good as the old gate. */
const SEARCHED_COLLECTORS = ['wikipedia', 'reference-hop'] as const;

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

const LANES = flag('lanes', '')
  .split(',')
  .map((lane) => lane.trim())
  .filter((lane) => lane.length > 0);
const SAMPLES = Number.parseInt(flag('samples', '12'), 10);
/** Narrow the audit to one collector — used to read its failures on their own, not to skip work. */
const COLLECTORS = flag('collectors', SEARCHED_COLLECTORS.join(','))
  .split(',')
  .map((name) => name.trim())
  .filter((name) => (SEARCHED_COLLECTORS as readonly string[]).includes(name));

type EvidenceAuditRow = {
  readonly id: string;
  readonly entity_id: string;
  readonly collector: string;
  readonly source_url: string;
  readonly title: string | null;
  readonly content_text: string;
  readonly display_name: string;
  readonly payload: { city?: string; county?: string; state?: string };
};

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  const params: unknown[] = [COLLECTORS];
  let laneClause = '';
  if (LANES.length > 0) {
    params.push(LANES);
    laneClause = ` AND e.lane = ANY($${params.length}::text[])`;
  }

  const rows = await pool.query<EvidenceAuditRow>(
    `SELECT e.id, e.entity_id, e.collector, e.source_url, e.title, e.content_text,
            c.display_name, c.payload
       FROM bb_research.entity_evidence e
       JOIN bb_research.landscape_candidates c ON c.id = e.entity_id
      WHERE e.status = 'captured' AND e.collector = ANY($1::text[])${laneClause}
      ORDER BY e.entity_id, e.id`,
    params,
  );
  console.log(`Auditing ${rows.rows.length} captured row(s) from ${COLLECTORS.join(', ')}.`);

  const failures: { row: EvidenceAuditRow; reason: string }[] = [];
  // Kept rows are sampled as well as rejected ones. A gate is only half-reviewed if you look at
  // what it throws away and not at what it lets through.
  const kept: EvidenceAuditRow[] = [];
  const byReason = new Map<string, number>();
  const byCollector = new Map<string, { kept: number; failed: number }>();

  for (const row of rows.rows) {
    const tally = byCollector.get(row.collector) ?? { kept: 0, failed: 0 };
    const identity = checkSubjectIdentity(
      row.content_text,
      {
        displayName: row.display_name,
        city: row.payload.city,
        county: row.payload.county,
        state: row.payload.state,
      },
      { title: row.title },
    );
    if (identity.corroborated) {
      tally.kept += 1;
      kept.push(row);
    } else {
      tally.failed += 1;
      const reason = identity.reason ?? 'unknown';
      failures.push({ row, reason });
      // Group on the reason's stable prefix — the name reason carries a hit count.
      const key = reason.split('(')[0]!.trim();
      byReason.set(key, (byReason.get(key) ?? 0) + 1);
    }
    byCollector.set(row.collector, tally);
  }

  console.log('\nBy collector:');
  for (const [collector, tally] of [...byCollector].sort()) {
    const total = tally.kept + tally.failed;
    const pct = total === 0 ? 0 : Math.round((tally.failed / total) * 100);
    console.log(`  ${collector}: ${tally.failed}/${total} would quarantine (${pct}%)`);
  }

  console.log('\nBy reason:');
  for (const [reason, count] of [...byReason].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(4)}  ${reason}`);
  }

  // Entities losing their LAST captured document matter more than the row count: those go back to
  // having no research at all, which is a re-sweep target rather than a quiet loss.
  const failedIds = new Set(failures.map((item) => item.row.id));
  const capturedByEntity = new Map<string, { total: number; failed: number }>();
  for (const row of rows.rows) {
    const tally = capturedByEntity.get(row.entity_id) ?? { total: 0, failed: 0 };
    tally.total += 1;
    if (failedIds.has(row.id)) tally.failed += 1;
    capturedByEntity.set(row.entity_id, tally);
  }
  const strandedEntities = [...capturedByEntity.values()].filter(
    (tally) => tally.total === tally.failed,
  ).length;
  console.log(
    `\nEntities losing every searched document: ${strandedEntities} of ${capturedByEntity.size}. ` +
      `(Nomination and canonical-URL evidence is untouched, so many of these still have tier1 text.)`,
  );

  // Spread the kept sample across the run rather than taking the first N, which would all come
  // from the same handful of entities (rows are ordered by entity).
  const keptStride = Math.max(1, Math.floor(kept.length / Math.max(1, SAMPLES)));
  console.log(`\nSample of kept rows (every ${keptStride}th of ${kept.length}):`);
  for (let i = 0; i < kept.length && i / keptStride < SAMPLES; i += keptStride) {
    const row = kept[i]!;
    console.log(`  ${row.display_name}`);
    console.log(`      ${row.title ?? '(untitled)'} — ${row.source_url}`);
  }

  console.log(`\nSample of ${Math.min(SAMPLES, failures.length)} failures:`);
  for (const item of failures.slice(0, SAMPLES)) {
    console.log(`  ${item.row.display_name}`);
    console.log(`      ${item.row.title ?? '(untitled)'} — ${item.row.source_url}`);
    console.log(`      ${item.reason}`);
  }

  // The honesty check: prose already published may have been written from and cited to a document
  // this audit is about to reject. Those records need re-drafting, not just a quarantined row.
  const publishedHits = await pool.query<{ id: string; display_name: string; source_url: string }>(
    `SELECT DISTINCT c.id, c.display_name, e.source_url
       FROM bb_research.entity_evidence e
       JOIN bb_research.landscape_candidates c ON c.id = e.entity_id
      WHERE e.id = ANY($1::text[])
        AND c.payload -> 'evidenceCitations' @> jsonb_build_array(
              jsonb_build_object('sourceUrl', e.source_url))
      ORDER BY c.display_name`,
    [[...failedIds]],
  );
  console.log(
    `\nStaged/published records citing a now-rejected document: ${publishedHits.rows.length}`,
  );
  for (const hit of publishedHits.rows) {
    console.log(`  ${hit.display_name} — ${hit.source_url}`);
  }

  if (DRY_RUN || !APPLY) {
    console.log('\nDRY_RUN=1 (default): no writes. Set DRY_RUN=0 AUDIT_EVIDENCE_IDENTITY_APPLY=1.');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of failures) {
      await client.query(
        `UPDATE bb_research.entity_evidence
            SET status = 'quarantined',
                provenance = provenance || $2::jsonb
          WHERE id = $1`,
        [
          item.row.id,
          JSON.stringify({
            quarantineReason: item.reason,
            // Distinguishes a row refused at capture from one refused in hindsight, so a later
            // reader can tell which gate version a quarantine reflects.
            quarantinedBy: 'audit-evidence-identity (repo-ppeu)',
          }),
        ],
      );
    }
    // Reconcile the ledger for entities this pass emptied. Their row still says 'pending', which
    // in this ledger means "evidence is in hand, WS4 has not drafted from it yet" — no longer true
    // once the last captured document is withdrawn, and `dump-enrichment-subjects` would keep
    // offering them as draftable subjects with nothing to draft from.
    //
    // Scoped to entities that have evidence rows, i.e. ones the sweep actually visited. Most
    // 'pending' rows in this ledger (2,333 of 2,894 on 2026-08-11) were seeded before any sweep
    // ran and have no evidence rows at all; sweeping them in here would mark them 'skipped' and
    // hide them from the selector for a full staleDays window, which is the opposite of the truth.
    const reconciled = await client.query(
      `UPDATE bb_research.entity_enrichment ee
          SET status = 'skipped',
              notes = COALESCE(ee.notes, '{}'::jsonb)
                      || jsonb_build_object('reason', 'evidence withdrawn by identity audit'),
              updated_at = now()
        WHERE ee.status = 'pending'
          AND EXISTS (SELECT 1 FROM bb_research.entity_evidence e WHERE e.entity_id = ee.entity_id)
          AND NOT EXISTS (
                SELECT 1 FROM bb_research.entity_evidence e
                 WHERE e.entity_id = ee.entity_id AND e.status = 'captured')`,
    );
    await client.query('COMMIT');
    console.log(`\nApplied: ${failures.length} row(s) moved captured -> quarantined.`);
    console.log(`Ledger reconciled: ${reconciled.rowCount ?? 0} entit(ies) pending -> skipped.`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
