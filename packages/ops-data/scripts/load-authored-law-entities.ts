/**
 * Loads authored law and court-case records from a JSON file into
 * `research.landscape_candidates`, validating every record against the publisher's own gate
 * before anything is written: the record must satisfy `buildReleaseSourceFromLandscape`, clear
 * `assessLandscapeDepth` and `gateLandscapePublishCandidate`, and carry claims whose text will
 * later let `validateApplicability` bind a `law_applicability` row to it. Records are data, so the
 * JSON lives outside git (session scratch or .cache).
 *
 * This script does NOT publish. It stages candidates in the research lane; the incremental
 * publisher is a separate, deliberate step the operator runs after reading the records. That
 * separation is the point: these records become public when published, and a loader that also
 * published would remove the review step between "authored" and "live".
 *
 * WHY THE DRY RUN RUNS THE REAL GATE. Restating the publisher's rules here would let the two
 * drift, and a record that validates against a copy of the gate and is then skipped by the gate
 * itself is worse than no check at all — audit-live-depth-gate.ts makes the same argument for the
 * same reason. So the dry run imports `gateLandscapePublishCandidate` and reports its actual
 * verdict per record, including the reason when it refuses. A `would publish` line here means the
 * publisher said so, not that this script thinks so.
 *
 * WHAT IT CANNOT PROVE. The gate is asked about a row that is not yet in the table, so
 * `exact_in_release` and `name_overlap` are read live from the active release and are true as of
 * this run. A standing `ops.catalog_decisions` verdict is not consulted: these ids are new, so
 * there is nothing to consult, and the publisher reads it for every id regardless.
 *
 * Usage (repo root):
 *   set -a && . apps/web/.env.local && set +a
 *   # Dry-run (default): validates, runs the publish gate, prints every record's verdict
 *   node --conditions development --import tsx packages/ops-data/scripts/load-authored-law-entities.ts \
 *     --file=/path/to/law-entities.json
 *   # Apply (writes when every record validates and binds; a record the publish gate would skip
 *   #  is still staged, by name, because staging is not publishing - see the guard's own comment)
 *   DRY_RUN=0 LOAD_LAW_ENTITIES_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/load-authored-law-entities.ts --file=/path/to/law-entities.json
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { resolveReleaseClaimId, type ReleaseSourceEntity } from '@repo/domain';
import {
  checkCitedYears,
  validateLawEntity,
  type AuthoredLawEntity,
  type AuthoredLawEntityFile,
  type LawEntityDbRow,
} from '../src/lives/law-entities.ts';
import {
  buildReleaseSourceFromLandscape,
  gateLandscapePublishCandidate,
  type LandscapePublishRow,
  type PublishGateResult,
} from './lib/incremental-publish.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const apply = process.env.DRY_RUN === '0' && process.env.LOAD_LAW_ENTITIES_APPLY === '1';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

/** The row as the publisher's own query would hand it back, plus the two live-release flags. */
function asPublishRow(
  row: LawEntityDbRow,
  live: { readonly exactInRelease: boolean; readonly nameOverlap: boolean },
): LandscapePublishRow {
  return {
    id: row.id,
    lane: row.lane,
    kind: row.kind,
    display_name: row.display_name,
    summary: row.summary,
    lat: row.lat,
    lng: row.lng,
    canonical_url: row.canonical_url,
    source_item_id: row.source_item_id,
    provenance: row.provenance,
    payload: row.payload,
    exact_in_release: live.exactInRelease,
    name_overlap: live.nameOverlap,
    // No enrichment draft can exist for a record this pass is creating.
    enrichment_draft_unstaged: false,
  };
}

/**
 * Claim id → the exact text `validateApplicability` will search, which is
 * `concat_ws(' ', claim->>'object', claim->>'citationLabel')` over claims with a non-empty
 * citationHref. Built from the entry the publisher itself derived, so the ids and the text are
 * the ones that will actually be published rather than a prediction of them.
 */
function claimTextForEntry(entry: ReleaseSourceEntity): ReadonlyMap<string, string> {
  const text = new Map<string, string>();
  for (const [index, claim] of (entry.claims ?? []).entries()) {
    if (!claim.citationHref || claim.citationHref.trim().length === 0) continue;
    text.set(resolveReleaseClaimId(entry, claim, index), `${claim.object} ${claim.citationLabel}`);
  }
  return text;
}

type Report = {
  readonly record: AuthoredLawEntity;
  readonly row: LawEntityDbRow;
  readonly warnings: readonly string[];
  readonly gate: PublishGateResult;
  readonly claimText: ReadonlyMap<string, string>;
};

function printReport(report: Report): void {
  const { record, gate } = report;
  const scope =
    record.scope.level === 'federal'
      ? 'federal'
      : `${record.scope.level} ${record.scope.jurisdictionName}`;
  const verdict = gate.eligible
    ? `gate PASS  basis ${gate.reviewBasis}`
    : `gate SKIP  ${gate.reason}: ${gate.detail}`;
  console.log(`\n${record.id}`);
  console.log(`  ${record.displayName} — ${scope} (${record.applicability.jurisdictionId})`);
  console.log(`  ${verdict}`);
  console.log(
    `  claims: ${report.claimText.size} cited — ${[...report.claimText.keys()].join(', ')}`,
  );

  const years = checkCitedYears({
    inForceFromEdtf: record.applicability.inForceFromEdtf,
    inForceToEdtf: record.applicability.inForceToEdtf ?? null,
    claimText: report.claimText,
  });
  for (const year of years) {
    console.log(
      year.cited
        ? `  bind ok   ${year.role} year ${year.year} cited by ${year.citedBy.join(', ')}`
        : `  bind FAIL ${year.role} year ${year.year} appears in no cited claim`,
    );
  }
  const window = `${record.applicability.inForceFromEdtf} → ${record.applicability.inForceToEdtf ?? 'open'}`;
  console.log(
    `  applicability: ${record.applicability.id}  ${window}  ` +
      `${record.applicability.textPosture}  disputed=${record.applicability.disputed === true}  ` +
      `domains=${record.applicability.lifeDomains.join(',')}`,
  );
  const disputes = record.disputes ?? [];
  if (disputes.length > 0) {
    for (const dispute of disputes) {
      console.log(
        `  dispute:  ${dispute.id} — ${dispute.positions.length} positions (${dispute.positions
          .map((p) => p.label)
          .join(', ')})`,
      );
    }
  }
  const verbatim = record.evidence.filter((c) => c.verbatim).length;
  console.log(
    `  evidence: ${record.evidence.length} citation(s), ${verbatim} verbatim, ${record.evidence.length - verbatim} sourced statement(s)`,
  );
  for (const gap of record.gaps ?? []) console.log(`  gap:      ${gap}`);
  for (const warning of report.warnings) console.log(`  warn:     ${warning}`);
}

async function main(): Promise<void> {
  const file = arg('file');
  if (!file) throw new Error('--file=<authored law entities JSON> is required');
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as AuthoredLawEntityFile;
  const authored = parsed.records;
  if (!Array.isArray(authored)) throw new Error('file must hold a `records` array');
  const duplicateIds = authored
    .map((record) => record.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) throw new Error(`duplicate ids: ${duplicateIds.join(', ')}`);
  const duplicateApplicabilityIds = authored
    .map((record) => record.applicability.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateApplicabilityIds.length > 0) {
    throw new Error(`duplicate applicability ids: ${duplicateApplicabilityIds.join(', ')}`);
  }

  const runId =
    arg('run-id') ??
    `manual_law_editorial_${new Date().toISOString().slice(0, 10).replace(/-/gu, '')}`;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = new pg.Pool(normalizePgConnectionString(url));
  try {
    const ids = authored.map((record) => record.id);
    const names = authored.map((record) => record.displayName);
    const [release, existing, inRelease, overlapping, jurisdictions] = await Promise.all([
      pool.query<{ release_id: string }>('SELECT release_id FROM published.active_release LIMIT 1'),
      pool.query<{ id: string }>(
        'SELECT id FROM research.landscape_candidates WHERE id = ANY($1::text[])',
        [ids],
      ),
      pool.query<{ entity_id: string }>(
        `SELECT e.entity_id FROM published.release_entities e
         JOIN published.active_release a ON a.release_id = e.release_id
         WHERE e.entity_id = ANY($1::text[])`,
        [ids],
      ),
      pool.query<{ display_name: string; entity_id: string }>(
        `SELECT e.display_name, e.entity_id FROM published.release_entities e
         JOIN published.active_release a ON a.release_id = e.release_id
         WHERE lower(e.display_name) = ANY(SELECT lower(n) FROM unnest($1::text[]) AS n)
           AND e.entity_id <> ALL($2::text[])`,
        [names, ids],
      ),
      pool.query<{ id: string }>(
        'SELECT id FROM reference.jurisdictions WHERE id = ANY($1::text[])',
        [[...new Set(authored.map((record) => record.applicability.jurisdictionId))]],
      ),
    ]);

    const releaseId = release.rows[0]?.release_id;
    if (!releaseId) throw new Error('no active release; the publish gate cannot be evaluated');
    const alreadyStaged = new Set(existing.rows.map((row) => row.id));
    const liveIds = new Set(inRelease.rows.map((row) => row.entity_id));
    const overlappingNames = new Set(
      overlapping.rows.map((row) => row.display_name.trim().toLowerCase()),
    );
    const knownJurisdictions = new Set(jurisdictions.rows.map((row) => row.id));
    const generatedAt = new Date().toISOString();

    const reports: Report[] = [];
    const failures: { readonly id: string; readonly errors: readonly string[] }[] = [];
    for (const record of authored) {
      const result = validateLawEntity(record, { runId });
      if (!result.ok) {
        failures.push({ id: result.id, errors: result.errors });
        console.log(`\n${result.id}\n  FAIL  ${result.errors.join('\n        ')}`);
        continue;
      }
      // Checked here rather than in the pure validator, which has no database: a jurisdiction that
      // does not exist makes the later law_applicability bind impossible, so it is worth saying
      // now rather than after these records are public.
      if (!knownJurisdictions.has(record.applicability.jurisdictionId)) {
        failures.push({
          id: record.id,
          errors: [`jurisdiction ${record.applicability.jurisdictionId} does not exist`],
        });
        console.log(
          `\n${record.id}\n  FAIL  jurisdiction ${record.applicability.jurisdictionId} does not exist`,
        );
        continue;
      }
      const publishRow = asPublishRow(result.row, {
        exactInRelease: liveIds.has(record.id),
        nameOverlap: overlappingNames.has(record.displayName.trim().toLowerCase()),
      });
      const entry = buildReleaseSourceFromLandscape(publishRow);
      const gate = gateLandscapePublishCandidate({ row: publishRow, releaseId, generatedAt });
      reports.push({
        record,
        row: result.row,
        warnings: result.warnings,
        gate,
        claimText: entry ? claimTextForEntry(entry) : new Map(),
      });
    }

    for (const report of reports) printReport(report);

    const gateSkips = reports.filter((report) => !report.gate.eligible);
    const bindFailures = reports.filter((report) =>
      checkCitedYears({
        inForceFromEdtf: report.record.applicability.inForceFromEdtf,
        inForceToEdtf: report.record.applicability.inForceToEdtf ?? null,
        claimText: report.claimText,
      }).some((year) => !year.cited),
    );

    console.log(
      `\n${reports.length} valid, ${failures.length} failing validation, ` +
        `${gateSkips.length} skipped by the publish gate, ${bindFailures.length} would not bind to law_applicability`,
    );
    const restaged = reports.filter((report) => alreadyStaged.has(report.record.id));
    if (restaged.length > 0) {
      console.log(
        `note: ${restaged.length} id(s) already exist in landscape_candidates and would be updated in place: ` +
          restaged.map((report) => report.record.id).join(', '),
      );
    }

    /*
     * Two of the three counts block the write; one does not, and the difference is who can fix it.
     *
     * A validation failure and a bind failure are AUTHORING defects. A record whose in-force year
     * appears in none of its own cited claims is a rule the timeline cannot place, which is the
     * whole reason these records are being authored — staging it would bank a row that has to be
     * rewritten anyway. Both block.
     *
     * A gate skip is not. `landscape_candidates` IS the research lane, and the gate's own header
     * says a rejected row is not discarded: it stays in the lane, where the enrichment sweep picks
     * it up, and the record surfaces its honest state instead of publishing as though the work
     * were done. Refusing to stage a validated, bindable record because it is one corroborating
     * source short of independent review would strand it outside the lane that exists to finish
     * it. So the skips are reported by name and the rows are written; nothing is published either
     * way, because this script does not publish.
     */
    if (failures.length > 0 || bindFailures.length > 0) {
      process.exitCode = 1;
      if (!apply) return;
      console.log(
        'Refusing to write: every record must validate and bind before any row is staged.',
      );
      return;
    }
    if (gateSkips.length > 0) {
      console.log(
        'These records stage but would NOT publish as authored, and each says why above: ' +
          gateSkips.map((report) => report.record.id).join(', '),
      );
    }
    if (!apply) {
      console.log('Dry run. Set DRY_RUN=0 LOAD_LAW_ENTITIES_APPLY=1 to write.');
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // `landscape_candidates.run_id` is a foreign key onto `source_program_runs`, so the run has to
      // exist before any candidate referencing it does. Every landscape row in this table was
      // written by some ingest run, and these records are no different for being authored by hand:
      // the run is what says where they came from and who may reuse the text.
      await client.query(
        `INSERT INTO research.source_program_runs (
           id, lane, source_program_id, source_program_name, custodian, license,
           rows_fetched, candidate_count, dropped_count, retrieved_at, summary, methodology_notes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$7,0, now(), $8::jsonb, $9::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           rows_fetched = EXCLUDED.rows_fetched,
           candidate_count = EXCLUDED.candidate_count,
           summary = EXCLUDED.summary,
           methodology_notes = EXCLUDED.methodology_notes,
           updated_at = now()`,
        [
          runId,
          'other',
          'law-editorial',
          'Law editorial backfill (Lives rules timeline)',
          'U.S. Government Publishing Office',
          'public-domain',
          reports.length,
          // `summary` and `methodology_notes` are jsonb on this table, holding JSON strings rather
          // than text, so both are stringified before they are cast.
          JSON.stringify(
            'Federal statutes and rulings, and state laws for the Midwest, Northeast and Texas & ' +
              'Oklahoma regions, staged so the Lives Across the Decades timeline can show which ' +
              'rules were in force for whom.',
          ),
          JSON.stringify(
            'Windows and claims transcribed from primary page images (govinfo, the Library of ' +
              'Congress U.S. Reports PDFs, state session laws and archives), not from summaries. ' +
              'Every in-force year is carried by a cited claim so law_applicability can bind to it. ' +
              'Contested points are staged as disputes with each position citing its own holder. ' +
              'Research packet: docs/research/lives-missing-laws-packet.md.',
          ),
        ],
      );

      for (const report of reports) {
        const row = report.row;
        await client.query(
          `INSERT INTO research.landscape_candidates (
             id, run_id, lane, source_program_id, source_item_id, display_name, kind, summary,
             lat, lng, canonical_url, research_lane_only, status, provenance, payload, discovered_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb, now())
           ON CONFLICT (id) DO UPDATE SET
             run_id = EXCLUDED.run_id,
             lane = EXCLUDED.lane,
             source_program_id = EXCLUDED.source_program_id,
             source_item_id = EXCLUDED.source_item_id,
             display_name = EXCLUDED.display_name,
             kind = EXCLUDED.kind,
             summary = EXCLUDED.summary,
             lat = EXCLUDED.lat,
             lng = EXCLUDED.lng,
             canonical_url = EXCLUDED.canonical_url,
             research_lane_only = EXCLUDED.research_lane_only,
             status = EXCLUDED.status,
             provenance = research.landscape_candidates.provenance || EXCLUDED.provenance,
             payload = EXCLUDED.payload,
             updated_at = now()`,
          [
            row.id,
            row.run_id,
            row.lane,
            row.source_program_id,
            row.source_item_id,
            row.display_name,
            row.kind,
            row.summary,
            row.lat,
            row.lng,
            row.canonical_url,
            row.research_lane_only,
            row.status,
            JSON.stringify(row.provenance),
            JSON.stringify(row.payload),
          ],
        );
      }
      await client.query('COMMIT');
      console.log(`Wrote ${reports.length} landscape candidate row(s).`);
      console.log(
        'Nothing is public yet. Review the rows, then publish with ' +
          'publish-release-entities-incremental.ts --ids=<...> as a separate step.',
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
