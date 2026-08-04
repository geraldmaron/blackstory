/**
 * Lane B / repo-bmmo — deterministic HBCU roster diff.
 *
 * Scrapes the U.S. Department of Education / White House Initiative on HBCUs
 * accredited-institution table and stages only net-new rows into
 * bb_research.landscape_candidates (lane='hbcu'). No LLM anywhere — pure
 * regex/HTML-table parsing of a static server-rendered page.
 *
 * Primary source: https://sites.ed.gov/whhbcu/one-hundred-and-five-historically-black-colleges-and-universities/
 * (linked from https://sites.ed.gov/whhbcu/ as "Accredited HBCU listing"; the
 * older /whhbcu/one-hundreds-strong/ URL 404s as of 2026-07).
 *
 * Diffs the scraped roster against BOTH:
 *   - existing bb_research.landscape_candidates rows with lane='hbcu' (any status)
 *   - bb_canonical.entities.display_name (case/punctuation-normalized)
 * so only genuinely net-new institutions are reported as would-be-staged.
 *
 * Every staged row's canonical_url (the institution's own site, from the
 * source table) is verified to actually fetch (via lib/fetch-page.ts, which
 * only returns a page on a successful HTTP fetch) before being counted as
 * net-new; failures are reported separately and never staged.
 *
 * Default is dry-run (plan + report only, no database writes). Production
 * writes require:
 *   DRY_RUN=0 HBCU_ROSTER_DIFF_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/scrape-hbcu-roster-diff.ts
 *
 * Apply DB writes (after reviewing the dry-run report):
 *   DRY_RUN=0 HBCU_ROSTER_DIFF_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/scrape-hbcu-roster-diff.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { fetchPage } from './lib/fetch-page.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const REPORT_DIR = join(REPO_ROOT, '.cache/landscape-intake');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.HBCU_ROSTER_DIFF_APPLY === '1';

const SOURCE_URL =
  'https://sites.ed.gov/whhbcu/one-hundred-and-five-historically-black-colleges-and-universities/';
const SOURCE_PROGRAM_ID = 'us-ed-whhbcu-accredited-listing';
const SOURCE_PROGRAM_NAME =
  'White House Initiative on HBCUs — Accredited HBCU Listing (U.S. Dept. of Education)';
const LANE = 'hbcu';

type ScrapedInstitution = {
  readonly displayName: string;
  readonly address: string;
  readonly websiteUrl: string;
  readonly typeLabel: string;
};

function stripTags(html: string): string {
  // Tags removed to a fixed point with `[^<>]`: one pass over `<scr<script>ipt>` leaves
  // `<script>` behind, and a class that matches `<` backtracks over a run of them.
  let withoutTags = html;
  let previous: string;
  do {
    previous = withoutTags;
    withoutTags = withoutTags.replace(/<[^<>]*>/gu, ' ');
  } while (withoutTags !== previous);

  return (
    withoutTags
      .replace(/&#8217;/gu, "'")
      .replace(/&nbsp;/gu, ' ')
      // `&amp;` decodes LAST. Decoding it first turns `&amp;nbsp;` into `&nbsp;`, which the rule
      // above would then turn into a space: one escape becoming two decodes
      // (CodeQL js/double-escaping).
      .replace(/&amp;/gu, '&')
      .replace(/\s+/gu, ' ')
      .trim()
  );
}

function normalizeWebsiteUrl(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const withScheme = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return undefined;
  }
}

/** Pure — parses the accredited-listing HTML table into rows. Exported for testability. */
export function parseHbcuTable(html: string): readonly ScrapedInstitution[] {
  const tableStart = html.indexOf('<table');
  if (tableStart === -1) {
    throw new Error('parseHbcuTable: no <table> found on the source page — structure changed');
  }
  const tableEnd = html.indexOf('</table>', tableStart);
  const table = html.slice(tableStart, tableEnd === -1 ? undefined : tableEnd);
  const rowMatches = table.match(/<tr[\s\S]*?<\/tr>/giu) ?? [];
  const institutions: ScrapedInstitution[] = [];
  for (const rowHtml of rowMatches) {
    const cellMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/giu)];
    if (cellMatches.length < 4) continue;
    const nameCell = cellMatches[0]![1]!;
    const addressCell = cellMatches[1]![1]!;
    const websiteCell = cellMatches[2]![1]!;
    const typeCell = cellMatches[3]![1]!;
    const displayName = stripTags(nameCell);
    if (!displayName || displayName.toLowerCase() === 'name') continue; // header row
    const hrefMatch = websiteCell.match(/href="([^"]+)"/iu);
    const websiteUrl = normalizeWebsiteUrl(hrefMatch ? hrefMatch[1]! : stripTags(websiteCell));
    if (!websiteUrl) continue;
    institutions.push({
      displayName,
      address: stripTags(addressCell),
      websiteUrl,
      typeLabel: stripTags(typeCell),
    });
  }
  return institutions;
}

function normalizeNameForDiff(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/&/gu, ' and ')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

/**
 * Institution-name synonym folds for dedup keys. College/University are folded
 * together on purpose: the roster's remaining "net-new" rows in the 2026-07-28
 * run were all College->University renames of institutions we already track
 * (repo-9qp9), and two distinct HBCUs never differ only by that word.
 */
const DEDUP_TOKEN_FOLDS: Readonly<Record<string, string>> = {
  university: 'univ',
  college: 'univ',
  agricultural: 'a',
  mechanical: 'm',
  saint: 'st',
};

/** Connectives dropped from dedup keys ('a'/'m' stay — they carry A&M). */
const DEDUP_DROP_TOKENS = new Set(['the', 'of', 'at', 'and', 'in', 'for']);

/**
 * Canonical dedup key: normalized tokens with synonym folds applied. Two rows
 * are duplicates when keys match exactly, or when one key extends the other
 * (campus and school sub-units, e.g. "University of the District of Columbia
 * David A. Clarke School of Law" extends "University of the District of
 * Columbia").
 */
function dedupKey(name: string): string {
  return normalizeNameForDiff(name)
    .split(' ')
    .filter((token) => token && !DEDUP_DROP_TOKENS.has(token))
    .map((token) => DEDUP_TOKEN_FOLDS[token] ?? token)
    .join(' ');
}

function matchesExistingKey(candidateKey: string, existingKeys: ReadonlySet<string>): boolean {
  if (existingKeys.has(candidateKey)) return true;
  const candidateCompact = candidateKey.replace(/ /gu, '');
  for (const existingKey of existingKeys) {
    if (candidateKey.startsWith(`${existingKey} `) || existingKey.startsWith(`${candidateKey} `)) {
      return true;
    }
    // Spacing variants: "Le Moyne-Owen" vs "LeMoyne-Owen".
    if (existingKey.replace(/ /gu, '') === candidateCompact) return true;
  }
  return false;
}

function slugify(name: string): string {
  return normalizeNameForDiff(name).replace(/\s+/gu, '-');
}

/** Low-signal tokens common to institution names — excluded from the overlap check. */
const NAME_STOPWORDS = new Set([
  'university',
  'college',
  'the',
  'of',
  'and',
  'a',
  'm',
  'state',
  'institute',
  'school',
  'at',
  'campus',
  'community',
  'technical',
]);

function nameTokens(name: string): Set<string> {
  return new Set(
    normalizeNameForDiff(name)
      .split(' ')
      .filter((t) => t && !NAME_STOPWORDS.has(t)),
  );
}

/**
 * Not a dedup decision — flags rows whose significant tokens substantially overlap
 * an existing lane name (e.g. "Florida Agricultural and Mechanical University" vs.
 * "Florida A&M University") so a human can check before applying. The exact-match
 * dedup above already excludes true duplicates; this only warns on likely variants
 * that exact-match normalization missed.
 */
function findLikelyNameVariant(
  candidateName: string,
  existingNames: readonly string[],
): string | undefined {
  const candidateTokens = nameTokens(candidateName);
  if (candidateTokens.size === 0) return undefined;
  for (const existingName of existingNames) {
    const existingTokens = nameTokens(existingName);
    if (existingTokens.size === 0) continue;
    const intersection = [...candidateTokens].filter((t) => existingTokens.has(t));
    const overlapRatio = intersection.length / Math.min(candidateTokens.size, existingTokens.size);
    if (overlapRatio >= 0.6) return existingName;
  }
  return undefined;
}

type ExistingRow = { readonly display_name: string; readonly status: string };
type ExistingEntity = { readonly display_name: string; readonly kind: string };

type Report = {
  readonly generatedAt: string;
  readonly sourceUrl: string;
  readonly sourceProgramId: string;
  readonly sourceProgramName: string;
  readonly dryRun: boolean;
  readonly counts: {
    readonly scraped: number;
    readonly dedupedOutLandscapeLane: number;
    readonly dedupedOutCanonicalEntities: number;
    readonly urlFailed: number;
    readonly netNew: number;
  };
  readonly netNewRows: readonly {
    readonly displayName: string;
    readonly kind: string;
    readonly canonicalUrl: string;
    readonly sourceItemId: string;
  }[];
  readonly urlFailedRows: readonly {
    readonly displayName: string;
    readonly canonicalUrl: string;
  }[];
  readonly dedupedOutLandscapeLaneNames: readonly string[];
  readonly dedupedOutCanonicalEntityNames: readonly string[];
  readonly likelyNameVariantWarnings: readonly {
    readonly candidateName: string;
    readonly matchesExisting: string;
  }[];
};

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');

  console.log(`Fetching HBCU accredited listing: ${SOURCE_URL}`);
  const page = await fetchPage(SOURCE_URL);
  if (!page) throw new Error(`failed to fetch source page: ${SOURCE_URL}`);
  const scraped = parseHbcuTable(page.html);
  console.log(`Parsed ${scraped.length} institutions from the source table.`);

  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const existingLandscapeRes = await pool.query<ExistingRow>(
    `SELECT display_name, status FROM bb_research.landscape_candidates WHERE lane = $1`,
    [LANE],
  );
  const existingEntitiesRes = await pool.query<ExistingEntity>(
    `SELECT display_name, kind FROM bb_canonical.entities`,
  );

  const existingLandscapeDisplayNames = existingLandscapeRes.rows.map((row) => row.display_name);
  const existingLandscapeNames = new Set(existingLandscapeDisplayNames.map(dedupKey));
  const existingEntityNames = new Set(
    existingEntitiesRes.rows.map((row) => dedupKey(row.display_name)),
  );

  console.log(
    `Existing landscape_candidates (lane='hbcu'): ${existingLandscapeRes.rows.length}. ` +
      `bb_canonical.entities total: ${existingEntitiesRes.rows.length}.`,
  );

  const dedupedOutLandscapeLaneNames: string[] = [];
  const dedupedOutCanonicalEntityNames: string[] = [];
  const urlFailedRows: { displayName: string; canonicalUrl: string }[] = [];
  const netNewRows: {
    displayName: string;
    kind: string;
    canonicalUrl: string;
    sourceItemId: string;
  }[] = [];
  const likelyNameVariantWarnings: { candidateName: string; matchesExisting: string }[] = [];

  for (const institution of scraped) {
    const candidateKey = dedupKey(institution.displayName);
    if (matchesExistingKey(candidateKey, existingLandscapeNames)) {
      dedupedOutLandscapeLaneNames.push(institution.displayName);
      continue;
    }
    if (matchesExistingKey(candidateKey, existingEntityNames)) {
      dedupedOutCanonicalEntityNames.push(institution.displayName);
      continue;
    }
    const verified = await fetchPage(institution.websiteUrl);
    if (!verified) {
      urlFailedRows.push({
        displayName: institution.displayName,
        canonicalUrl: institution.websiteUrl,
      });
      continue;
    }
    const variantMatch = findLikelyNameVariant(
      institution.displayName,
      existingLandscapeDisplayNames,
    );
    if (variantMatch) {
      likelyNameVariantWarnings.push({
        candidateName: institution.displayName,
        matchesExisting: variantMatch,
      });
    }
    netNewRows.push({
      displayName: institution.displayName,
      kind: 'place',
      canonicalUrl: institution.websiteUrl,
      sourceItemId: slugify(institution.displayName),
    });
  }

  const report: Report = {
    generatedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    sourceProgramId: SOURCE_PROGRAM_ID,
    sourceProgramName: SOURCE_PROGRAM_NAME,
    dryRun: DRY_RUN || !APPLY,
    counts: {
      scraped: scraped.length,
      dedupedOutLandscapeLane: dedupedOutLandscapeLaneNames.length,
      dedupedOutCanonicalEntities: dedupedOutCanonicalEntityNames.length,
      urlFailed: urlFailedRows.length,
      netNew: netNewRows.length,
    },
    netNewRows,
    urlFailedRows,
    dedupedOutLandscapeLaneNames,
    dedupedOutCanonicalEntityNames,
    likelyNameVariantWarnings,
  };

  console.log('\nWould-be-staged rows (net-new):');
  console.table(
    netNewRows.map((row) => ({
      name: row.displayName,
      kind: row.kind,
      canonical_url: row.canonicalUrl,
    })),
  );
  console.log(
    `\nCounts: scraped=${report.counts.scraped} ` +
      `deduped-out(lane)=${report.counts.dedupedOutLandscapeLane} ` +
      `deduped-out(canonical)=${report.counts.dedupedOutCanonicalEntities} ` +
      `url-failed=${report.counts.urlFailed} ` +
      `net-new=${report.counts.netNew}`,
  );
  if (urlFailedRows.length > 0) {
    console.log('\nURL-failed rows (skipped, not staged):');
    console.table(urlFailedRows);
  }
  if (likelyNameVariantWarnings.length > 0) {
    console.log(
      `\nWARNING: ${likelyNameVariantWarnings.length} net-new row(s) look like name variants of an ` +
        "existing lane='hbcu' row (token overlap >= 60%). Staged as net-new but flagged for manual review:",
    );
    console.table(
      likelyNameVariantWarnings.map((w) => ({
        candidate: w.candidateName,
        existing: w.matchesExisting,
      })),
    );
  }

  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = join(
    REPORT_DIR,
    `hbcu-roster-diff-${report.generatedAt.replace(/[:.]/gu, '-')}.json`,
  );
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${reportPath}`);

  if (DRY_RUN || !APPLY) {
    console.log(
      '\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 HBCU_ROSTER_DIFF_APPLY=1 to apply.',
    );
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const runId = `hbcu-negro-leagues-diff-${report.generatedAt.slice(0, 10)}`;
    await client.query(
      `INSERT INTO bb_research.source_program_runs
        (id, lane, source_program_id, source_program_name, canonical_url, retrieved_at,
         rows_fetched, candidate_count, dropped_count, summary, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
       ON CONFLICT (id) DO UPDATE SET
         rows_fetched = EXCLUDED.rows_fetched,
         candidate_count = EXCLUDED.candidate_count,
         dropped_count = EXCLUDED.dropped_count,
         summary = EXCLUDED.summary,
         updated_at = now()`,
      [
        runId,
        LANE,
        SOURCE_PROGRAM_ID,
        SOURCE_PROGRAM_NAME,
        SOURCE_URL,
        report.generatedAt,
        report.counts.scraped,
        report.counts.netNew,
        report.counts.scraped - report.counts.netNew,
        JSON.stringify(report.counts),
      ],
    );
    for (const row of netNewRows) {
      const id = `${LANE}-${row.sourceItemId}`;
      await client.query(
        `INSERT INTO bb_research.landscape_candidates
          (id, run_id, lane, source_program_id, source_item_id, display_name, kind, summary,
           lat, lng, canonical_url, research_lane_only, status, provenance, payload, discovered_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,'pending',$12,$13,$14,now())
         ON CONFLICT (lane, source_item_id) DO NOTHING`,
        [
          id,
          runId,
          LANE,
          SOURCE_PROGRAM_ID,
          row.sourceItemId,
          row.displayName,
          row.kind,
          null,
          null,
          null,
          row.canonicalUrl,
          JSON.stringify({
            sourceId: SOURCE_PROGRAM_ID,
            sourceUrl: SOURCE_URL,
            capturedAt: report.generatedAt,
          }),
          JSON.stringify(row),
          report.generatedAt,
        ],
      );
    }
    await client.query('COMMIT');
    console.log(
      `Applied: upserted run ${runId}, inserted up to ${netNewRows.length} candidate row(s) (ON CONFLICT DO NOTHING on (lane, source_item_id)).`,
    );
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
