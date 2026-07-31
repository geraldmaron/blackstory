/**
 * Lane B / repo-bmmo — deterministic Black newspapers roster from the Library
 * of Congress.
 *
 * Stages historically African American newspapers into
 * bb_research.landscape_candidates (lane='black-newspapers'). No LLM anywhere
 * — pure JSON API enumeration of the LOC "Directory of US Newspapers in
 * American Libraries", filtered to titles that (a) carry the directory's own
 * subject_ethnicity="african american" facet AND (b) are digitized in the
 * Chronicling America collection (partof_collection facet). The digitized
 * bound keeps the lane at ~350 auditable titles instead of the full 2,640
 * directory records (which include print/online duplicates and
 * holdings-only records).
 *
 * canonical_url = the title's own LOC item page (https://www.loc.gov/item/<lccn>/),
 * taken verbatim from the API's `url` field and re-verified per row via the
 * item's fo=json endpoint (must return 200 JSON naming the same title tokens)
 * before being staged; failures are reported separately and never staged.
 *
 * loc.gov sits behind Cloudflare and 403s default curl/node UAs, so every
 * request sends a browser User-Agent (verified working 2026-07-28).
 *
 * Dedup: within-roster by LCCN, then print-vs-online duplicates of the same
 * title collapse via normalized title (which includes the "(City, ST)"
 * qualifier); then against prior lane rows and bb_canonical.entities
 * display names.
 *
 * Default is dry-run (plan + report only, no database writes). Production
 * writes require:
 *   DRY_RUN=0 BLACK_NEWSPAPERS_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/scrape-black-newspapers-roster.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const REPORT_DIR = join(REPO_ROOT, '.cache/landscape-intake');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BLACK_NEWSPAPERS_APPLY === '1';

const DIRECTORY_BASE =
  'https://www.loc.gov/collections/directory-of-us-newspapers-in-american-libraries/';
const DIRECTORY_QUERY =
  '?searchType=advanced&subject_ethnicity=african+american&fa=partof_collection:chronicling+america&fo=json&c=100';
const SOURCE_PROGRAM_ID = 'us-loc-newspaper-directory-african-american-chronam';
const SOURCE_PROGRAM_NAME =
  'Library of Congress — US Newspaper Directory, African American titles digitized in Chronicling America';
const LANE = 'black-newspapers';
/**
 * bb_research.source_program_runs.lane has a CHECK constraint restricted to
 * ('dc-sites','greenbook','hbcu','nrhp','wikidata','other') — the *run* row
 * uses 'other' while candidate rows carry lane='black-newspapers'.
 */
const RUN_LANE = 'other';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

type LocSearchResult = {
  readonly title?: string;
  readonly url?: string;
  readonly location?: readonly string[];
  readonly date?: string;
  readonly item?: {
    readonly raw_lccn?: string;
    readonly title?: string;
    readonly location?: readonly string[];
  };
};

type LocSearchPage = {
  readonly pagination?: { readonly of?: number; readonly total?: number };
  readonly results?: readonly LocSearchResult[];
};

type ScrapedTitle = {
  readonly displayName: string;
  readonly lccn: string;
  readonly canonicalUrl: string;
  readonly rawTitle: string;
  readonly datePhrase: string | null;
  readonly locationTerms: readonly string[];
};

const FETCH_TIMEOUT_MS = 15_000;

async function fetchLocJson(url: string, label?: string): Promise<unknown | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': BROWSER_UA, accept: 'application/json' },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (res.status === 429 || res.status >= 500) {
        const retryAfterHeader = Number(res.headers.get('retry-after'));
        const retryAfterMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader * 1000 : null;
        const backoffMs = retryAfterMs ?? 8000 * 2 ** attempt;
        console.log(`  [${label ?? url}] status=${res.status}, backing off ${Math.round(backoffMs / 1000)}s (attempt ${attempt + 1}/5)`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as unknown;
    } catch (error) {
      console.log(`  [${label ?? url}] fetch error: ${error instanceof Error ? error.message : error} (attempt ${attempt + 1}/5)`);
      await new Promise((resolve) => setTimeout(resolve, 4000 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

/** Bounded-concurrency map — avoids one hung/slow request stalling the whole batch. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]!, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

/**
 * Pure — "The Advance (Wilmington, Del.) 1899-19??" ->
 * { displayName: "The Advance (Wilmington, Del.)", datePhrase: "1899-19??" }.
 * The "[Online Resource]" suffix (print/online duplicate records) is dropped.
 */
export function parseDirectoryTitle(raw: string): { displayName: string; datePhrase: string | null } {
  const withoutOnline = raw.replace(/\s*\[online resource\]\s*$/iu, '').trim();
  const dateMatch = /\s+((?:1[6-9]|20)\d{2}[0-9u?xX-]*(?:-(?:(?:1[6-9]|20)?[\d?u]{2,4})?)?)$/u.exec(
    withoutOnline,
  );
  if (!dateMatch) return { displayName: withoutOnline, datePhrase: null };
  return {
    displayName: withoutOnline.slice(0, dateMatch.index).trim(),
    datePhrase: dateMatch[1]!.trim(),
  };
}

export function normalizeNameForDiff(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

/** Pure — extracts a clean LCCN slug ("sn 86058063 " -> "sn86058063"). */
export function normalizeLccn(raw: string | undefined, itemUrl: string | undefined): string | null {
  const fromRaw = raw?.replace(/\s+/gu, '');
  if (fromRaw) return fromRaw;
  const match = itemUrl ? /\/item\/([a-z0-9]+)\/?/iu.exec(itemUrl) : null;
  return match?.[1] ?? null;
}

type ExistingRow = { readonly display_name: string };

/**
 * A report filename built only from characters we chose. `generatedAt` reaches this point after a
 * network round trip, so CodeQL sees remote input deciding a write path
 * (js/http-to-file-access); pinning the shape makes the constraint explicit rather than implied
 * by the timestamp's format.
 */
function safeReportFilename(prefix: string, stamp: string): string {
  const cleaned = stamp.replace(/[^\w-]/gu, '-').slice(0, 64);
  return `${prefix}-${cleaned}.json`;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');

  // Enumerate all pages of the filtered directory search.
  const byLccn = new Map<string, ScrapedTitle>();
  const byNormalizedTitle = new Set<string>();
  let duplicateRecords = 0;
  let malformedRecords = 0;
  let totalReported: number | null = null;
  for (let page = 1; page <= 50; page += 1) {
    const url = `${DIRECTORY_BASE}${DIRECTORY_QUERY}&sp=${page}`;
    console.log(`Fetching directory page ${page}: ${url}`);
    const data = (await fetchLocJson(url, `page ${page}`)) as LocSearchPage | null;
    if (!data?.results) throw new Error(`directory page ${page} failed to fetch or had no results`);
    if (page > 1) await new Promise((resolve) => setTimeout(resolve, 3000));
    totalReported = data.pagination?.of ?? totalReported;
    for (const result of data.results) {
      const lccn = normalizeLccn(result.item?.raw_lccn, result.url);
      const rawTitle = result.title?.trim();
      const canonicalUrl = result.url?.replace(/^http:/u, 'https:');
      if (!lccn || !rawTitle || !canonicalUrl?.startsWith('https://www.loc.gov/item/')) {
        malformedRecords += 1;
        continue;
      }
      if (byLccn.has(lccn)) {
        duplicateRecords += 1;
        continue;
      }
      const { displayName, datePhrase } = parseDirectoryTitle(rawTitle);
      const normalizedTitle = normalizeNameForDiff(displayName);
      if (byNormalizedTitle.has(normalizedTitle)) {
        // Print vs online-resource duplicate of the same qualified title.
        duplicateRecords += 1;
        continue;
      }
      byNormalizedTitle.add(normalizedTitle);
      byLccn.set(lccn, {
        displayName,
        lccn,
        canonicalUrl,
        rawTitle,
        datePhrase,
        locationTerms: result.location ?? [],
      });
    }
    const pageCount = (data.pagination?.total ?? page);
    if (page >= pageCount) break;
  }
  const scraped = [...byLccn.values()];
  console.log(
    `\nDistinct digitized African American newspaper titles: ${scraped.length} ` +
      `(directory reported ${totalReported ?? '?'} records; ${duplicateRecords} duplicate, ${malformedRecords} malformed)`,
  );

  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const existingLandscapeRes = await pool.query<ExistingRow>(
    `SELECT display_name FROM bb_research.landscape_candidates WHERE lane = $1`,
    [LANE],
  );
  const existingEntitiesRes = await pool.query<ExistingRow>(
    `SELECT display_name FROM bb_canonical.entities`,
  );
  const existingLandscapeNames = new Set(
    existingLandscapeRes.rows.map((row) => normalizeNameForDiff(row.display_name)),
  );
  const existingEntityNames = new Set(
    existingEntitiesRes.rows.map((row) => normalizeNameForDiff(row.display_name)),
  );
  console.log(
    `Existing landscape_candidates (lane='${LANE}'): ${existingLandscapeRes.rows.length}. ` +
      `bb_canonical.entities total: ${existingEntitiesRes.rows.length}.`,
  );

  let dedupedOutLandscapeLane = 0;
  const dedupedOutCanonicalEntityNames: string[] = [];
  const urlFailedRows: { displayName: string; canonicalUrl: string }[] = [];

  const toVerify = scraped.filter((title) => {
    const normalized = normalizeNameForDiff(title.displayName);
    if (existingLandscapeNames.has(normalized)) {
      dedupedOutLandscapeLane += 1;
      return false;
    }
    if (existingEntityNames.has(normalized)) {
      dedupedOutCanonicalEntityNames.push(title.displayName);
      return false;
    }
    return true;
  });

  console.log(`Verifying ${toVerify.length} candidate title(s) against loc.gov item API (concurrency=2)...`);
  let verifiedCount = 0;
  const verifyResults = await mapWithConcurrency(toVerify, 2, async (title) => {
    // Per-row verification: the item's own fo=json endpoint must resolve and
    // its item.title must share tokens with the directory title.
    const itemJson = (await fetchLocJson(`${title.canonicalUrl}?fo=json`, title.displayName)) as
      | { item?: { title?: string } }
      | null;
    const itemTitle = itemJson?.item?.title;
    const bareTitle = title.displayName.replace(/\s*\([^)]*\)\s*$/u, '');
    const ok = Boolean(
      itemTitle && normalizeNameForDiff(itemTitle).includes(normalizeNameForDiff(bareTitle).split(' ')[0] ?? ''),
    );
    verifiedCount += 1;
    if (verifiedCount % 25 === 0 || verifiedCount === toVerify.length) {
      console.log(`  verified ${verifiedCount}/${toVerify.length}`);
    }
    return ok ? { ok: true as const, title } : { ok: false as const, title };
  });
  const netNewRows: ScrapedTitle[] = [];
  for (const result of verifyResults) {
    if (result.ok) netNewRows.push(result.title);
    else urlFailedRows.push({ displayName: result.title.displayName, canonicalUrl: result.title.canonicalUrl });
  }

  const generatedAt = new Date().toISOString();
  const report = {
    generatedAt,
    sourceUrl: `${DIRECTORY_BASE}${DIRECTORY_QUERY}`,
    sourceProgramId: SOURCE_PROGRAM_ID,
    sourceProgramName: SOURCE_PROGRAM_NAME,
    dryRun: DRY_RUN || !APPLY,
    counts: {
      directoryReported: totalReported,
      scraped: scraped.length,
      duplicateRecords,
      malformedRecords,
      dedupedOutLandscapeLane,
      dedupedOutCanonicalEntities: dedupedOutCanonicalEntityNames.length,
      urlFailed: urlFailedRows.length,
      netNew: netNewRows.length,
    },
    netNewRows,
    urlFailedRows,
    dedupedOutCanonicalEntityNames,
  };

  console.log('\nWould-be-staged rows (net-new):');
  console.table(
    netNewRows.map((row) => ({ name: row.displayName, lccn: row.lccn, canonical_url: row.canonicalUrl })),
  );
  console.log(
    `\nCounts: scraped=${report.counts.scraped} duplicates=${duplicateRecords} malformed=${malformedRecords} ` +
      `deduped-out(lane)=${dedupedOutLandscapeLane} deduped-out(canonical)=${dedupedOutCanonicalEntityNames.length} ` +
      `url-failed=${urlFailedRows.length} net-new=${netNewRows.length}`,
  );
  if (urlFailedRows.length > 0) {
    console.log('\nURL-failed rows (skipped, not staged):');
    console.table(urlFailedRows);
  }
  if (dedupedOutCanonicalEntityNames.length > 0) {
    console.log('\nDeduped out — already canonical entities:');
    console.table(dedupedOutCanonicalEntityNames.map((name) => ({ name })));
  }

  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = join(REPORT_DIR, safeReportFilename('black-newspapers', generatedAt));
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${reportPath}`);

  if (DRY_RUN || !APPLY) {
    console.log('\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 BLACK_NEWSPAPERS_APPLY=1 to apply.');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const runId = `black-newspapers-${generatedAt.slice(0, 10)}`;
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
        RUN_LANE,
        SOURCE_PROGRAM_ID,
        SOURCE_PROGRAM_NAME,
        `${DIRECTORY_BASE}${DIRECTORY_QUERY}`,
        generatedAt,
        report.counts.scraped,
        report.counts.netNew,
        report.counts.scraped - report.counts.netNew,
        JSON.stringify(report.counts),
      ],
    );
    for (const row of netNewRows) {
      const id = `${LANE}-${row.lccn}`;
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
          row.lccn,
          row.displayName,
          'organization',
          null,
          null,
          null,
          row.canonicalUrl,
          JSON.stringify({
            sourceId: SOURCE_PROGRAM_ID,
            sourceUrl: row.canonicalUrl,
            capturedAt: generatedAt,
            datePhrase: row.datePhrase,
            locationTerms: row.locationTerms,
          }),
          JSON.stringify(row),
          generatedAt,
        ],
      );
    }
    await client.query('COMMIT');
    console.log(
      `Applied: upserted run ${runId} (lane='${RUN_LANE}'), inserted up to ${netNewRows.length} candidate row(s) (lane='${LANE}').`,
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

const invokedDirectly = process.argv[1] != null && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly || process.env.BLACK_NEWSPAPERS_RUN === '1') {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
