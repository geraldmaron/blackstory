/**
 * CLI for the repo-z97f audit: `first_to_do_x` / `only_or_oldest` notability-basis rows in the
 * active release whose resolved evidence is Wikipedia and nothing else. See
 * lib/superlative-wikipedia-audit.ts for what counts and why — this file only reads Postgres,
 * shapes the rows into that module's input, and prints/writes the result.
 *
 * docs/research/citation-standard.md: Wikipedia may carry a claim but never corroborates one and
 * is never sufficient for a superlative. William F. Penn's record asserted "First African
 * American to graduate from Yale Medical School (1897)" on Wikipedia's authority alone; Yale says
 * the actual first was Cortlandt Van Rensselaer Creed, MD 1857. That is the failure mode this
 * finds — before a reader finds it first.
 *
 * Read-only. Writes nothing to the database.
 *
 * Usage (from repo root):
 *   cd apps/web && set -a && . ./.env.local && set +a && \
 *     node --conditions development --import tsx \
 *     ../../packages/ops-data/scripts/audit-superlative-wikipedia-only.ts [--json <path>]
 *
 * `--json <path>` additionally writes the full finding list (one object per notability-basis row)
 * to that path, for working the cohort afterward — each entity needs its own judgment call
 * (corroborate institutionally, soften the summary/basis, or withdraw the claim), and that is not
 * something this script decides.
 */
import { writeFile } from 'node:fs/promises';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  auditSuperlativeWikipediaOnly,
  summarizeFindings,
  type AuditClaim,
  type AuditEntity,
  type AuditNotabilityBasis,
} from './lib/superlative-wikipedia-audit.ts';

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
  readonly summary: string | null;
  readonly claims: readonly AuditClaim[] | null;
  readonly projection: { notabilityBasis?: readonly AuditNotabilityBasis[] } | null;
};

function parseArgs(argv: readonly string[]): { readonly jsonPath?: string } {
  const jsonFlagIndex = argv.indexOf('--json');
  if (jsonFlagIndex === -1) return {};
  const jsonPath = argv[jsonFlagIndex + 1];
  if (!jsonPath) throw new Error('--json requires a path argument');
  return { jsonPath };
}

async function main(): Promise<void> {
  const { jsonPath } = parseArgs(process.argv.slice(2));
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
      `SELECT entity_id, display_name, kind, summary, claims, projection
         FROM bb_public.release_entities WHERE release_id = $1 ORDER BY kind, display_name`,
      [releaseId],
    );

    const entities: AuditEntity[] = rows.map((row) => ({
      entityId: row.entity_id,
      displayName: row.display_name,
      kind: row.kind,
      summary: row.summary,
      claims: row.claims ?? [],
      notabilityBasis: row.projection?.notabilityBasis ?? [],
    }));

    const findings = auditSuperlativeWikipediaOnly(entities);
    const summary = summarizeFindings(findings);

    console.log(`release ${releaseId} — ${rows.length} entities scanned`);
    console.log(
      `\n${summary.totalFindingRows} first_to_do_x/only_or_oldest basis rows across ` +
        `${summary.distinctEntities} entities rest on Wikipedia alone:`,
    );
    console.log(`  first_to_do_x:  ${summary.byCriterion.first_to_do_x}`);
    console.log(`  only_or_oldest: ${summary.byCriterion.only_or_oldest}`);
    console.log(
      `  no non-Wikipedia claim anywhere on the entity: ${summary.noNonWikipediaClaimAtAll}`,
    );
    console.log(
      `  superlative language also reaches the published summary: ${summary.reachesPublishedSummary}`,
    );

    const danglingCount = findings.filter((f) => f.danglingEvidenceIds.length > 0).length;
    if (danglingCount > 0) {
      console.log(
        `\n  NOTE: ${danglingCount} finding(s) also carry evidenceIds that resolve to no claim ` +
          'on the entity — a separate data-integrity gap alongside the citation problem.',
      );
    }

    console.log(
      '\n== rows carrying the superlative into the published summary (highest priority) ==',
    );
    for (const finding of findings.filter((f) => f.summaryCarriesSuperlative)) {
      console.log(
        `  ${finding.entityId} (${finding.kind}) :: ${finding.criterion} :: ${finding.note}`,
      );
    }

    if (jsonPath) {
      await writeFile(jsonPath, JSON.stringify({ releaseId, summary, findings }, null, 2), 'utf8');
      console.log(`\nWrote ${findings.length} finding rows to ${jsonPath}`);
    }
  } finally {
    await client.end();
  }
}

await main();
