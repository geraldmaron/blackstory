/**
 * Lane B / repo-bmmo — deterministic Negro Leagues Hall of Fame roster scraper.
 *
 * Stages Negro Leagues-era National Baseball Hall of Fame inductees into
 * bb_research.landscape_candidates (lane='negro-leagues-hof'). No LLM
 * anywhere — pure regex/HTML parsing of a server-rendered Drupal Views page.
 *
 * baseballhall.org has no dedicated "Negro Leagues era" facet: the Hall of
 * Fame Explorer (https://baseballhall.org/hall-of-fame/hall-of-fame-explorer)
 * exposes a server-rendered `?primary_team=<id>` filter over a fixed list of
 * team options. NEGRO_LEAGUE_TEAM_OPTIONS below is that exact option list
 * (value + label) copied verbatim from the page's own <select name="primary_team">
 * markup, filtered down to genuine Negro Leagues-era franchises (excludes
 * same-named MLB/other-league entries that share the select, e.g. "New York
 * Giants" (NL) id=43 and "San Francisco Giants" id=97). Each team id is
 * queried individually; every Hall of Famer whose *primary* team is one of
 * these franchises is enumerated this way — this is the site's own
 * authoritative grouping, not a guessed roster.
 *
 * canonical_url = the inductee's own /hall-of-famers/<slug> HOF page, verified
 * to actually fetch (via lib/fetch-page.ts) before being staged; failures are
 * reported separately and never staged.
 *
 * Dedup: lane='negro-leagues-hof' has no prior rows (new lane), so the
 * meaningful diff is against bb_canonical.entities.display_name — several
 * Negro Leagues honorees (Satchel Paige, Jackie Robinson, Josh Gibson, Cool
 * Papa Bell, ...) are already canonical people entities in this dataset and
 * must not be re-staged.
 *
 * Default is dry-run (plan + report only, no database writes). Production
 * writes require:
 *   DRY_RUN=0 NEGRO_LEAGUES_HOF_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/scrape-negro-leagues-hof-roster.ts
 *
 * Apply DB writes (after reviewing the dry-run report):
 *   DRY_RUN=0 NEGRO_LEAGUES_HOF_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/scrape-negro-leagues-hof-roster.ts
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
const APPLY = process.env.NEGRO_LEAGUES_HOF_APPLY === '1';

const EXPLORER_URL = 'https://baseballhall.org/hall-of-fame/hall-of-fame-explorer';
const HOF_BASE_URL = 'https://baseballhall.org';
const SOURCE_PROGRAM_ID = 'us-baseballhall-negro-leagues-explorer';
const SOURCE_PROGRAM_NAME =
  'National Baseball Hall of Fame — Hall of Fame Explorer, Negro Leagues-era primary-team franchises';
const LANE = 'negro-leagues-hof';
/**
 * bb_research.source_program_runs.lane has a CHECK constraint restricted to
 * ('dc-sites','greenbook','hbcu','nrhp','wikidata','other') — 'negro-leagues-hof'
 * isn't a member, so the *run* row uses 'other' while every candidate row still
 * carries lane='negro-leagues-hof' (landscape_candidates.lane has no CHECK).
 */
const RUN_LANE = 'other';

/**
 * Verbatim (value, label) pairs from baseballhall.org's own
 * <select name="primary_team"> on the Hall of Fame Explorer, filtered to
 * Negro Leagues-era franchises. Excludes same-named MLB entries sharing the
 * dropdown (New York Giants id=43, New York Giants PL id=317, Providence
 * Grays id=190, San Francisco Giants id=97).
 */
const NEGRO_LEAGUE_TEAM_OPTIONS: readonly { readonly id: string; readonly name: string }[] = [
  { id: '715', name: 'Baltimore Black Sox' },
  { id: '711', name: 'Baltimore/Washington Elite Giants' },
  { id: '730', name: 'Birmingham Black Barons' },
  { id: '376', name: 'Brooklyn Eagles' },
  { id: '323', name: 'Brooklyn Royal Giants' },
  { id: '328', name: 'Chicago American Giants' },
  { id: '772', name: 'Chicago Leland Giants' },
  { id: '713', name: 'Cuban Giants' },
  { id: '540', name: 'Cuban Stars' },
  { id: '379', name: 'Cuban Stars (West)' },
  { id: '723', name: 'Cuban X Giants' },
  { id: '351', name: 'Detroit Stars' },
  { id: '370', name: 'Harrisburg Giants' },
  { id: '429', name: 'Hilldale Giants' },
  { id: '80', name: 'Homestead Grays' },
  { id: '372', name: 'Indianapolis ABCs' },
  { id: '152', name: 'Kansas City Monarchs' },
  { id: '369', name: 'Lincoln Giants' },
  { id: '312', name: 'Monroe Monarchs' },
  { id: '313', name: 'New Orleans Black Creoles' },
  { id: '371', name: 'New York Bacharach Giants' },
  { id: '63', name: 'New York Cubans' },
  { id: '322', name: 'New York Lincoln Giants' },
  { id: '48', name: 'Newark Eagles' },
  { id: '321', name: 'Philadelphia Giants' },
  { id: '430', name: 'Philadelphia Stars' },
  { id: '121', name: 'Pittsburgh Crawfords' },
  { id: '368', name: 'St. Louis Giants' },
  { id: '330', name: 'St. Louis Stars' },
];

type ScrapedInductee = {
  readonly displayName: string;
  readonly slug: string;
  readonly canonicalUrl: string;
  readonly primaryTeam: string;
  readonly classOf: string | null;
};

/** Pure — parses one Hall of Fame Explorer results page into inductee cards. */
export function parseExplorerResults(
  html: string,
  primaryTeam: string,
): readonly ScrapedInductee[] {
  const cardPattern =
    /href="(\/hall-of-famers\/[a-z0-9-]+)"\s+class="image-card[^"]*">[\s\S]*?<h3 class="h4">([^<]+)<\/h3>[\s\S]*?(?:<span class="number">([^<]+)<\/span>)?/giu;
  const inductees: ScrapedInductee[] = [];
  let match: RegExpExecArray | null;
  while ((match = cardPattern.exec(html)) !== null) {
    const path = match[1]!;
    const displayName = match[2]!.trim();
    const classOf = match[3]?.trim() ?? null;
    const slug = path.replace('/hall-of-famers/', '');
    inductees.push({
      displayName,
      slug,
      canonicalUrl: `${HOF_BASE_URL}${path}`,
      primaryTeam,
      classOf,
    });
  }
  return inductees;
}

function normalizeNameForDiff(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

type ExistingEntity = { readonly display_name: string };
type ExistingLandscapeRow = {
  readonly display_name: string;
  readonly canonical_url: string | null;
};

type Report = {
  readonly generatedAt: string;
  readonly sourceUrl: string;
  readonly sourceProgramId: string;
  readonly sourceProgramName: string;
  readonly teamsQueried: number;
  readonly dryRun: boolean;
  readonly counts: {
    readonly scraped: number;
    readonly dedupedOutDuplicateCard: number;
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
    readonly primaryTeam: string;
    readonly classOf: string | null;
  }[];
  readonly urlFailedRows: readonly {
    readonly displayName: string;
    readonly canonicalUrl: string;
  }[];
  readonly dedupedOutCanonicalEntityNames: readonly string[];
};

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');

  const bySlug = new Map<string, ScrapedInductee>();
  let duplicateCards = 0;
  for (const team of NEGRO_LEAGUE_TEAM_OPTIONS) {
    const url = `${EXPLORER_URL}?primary_team=${team.id}`;
    console.log(`Fetching ${team.name} (id=${team.id}): ${url}`);
    const page = await fetchPage(url);
    if (!page) {
      console.warn(`  WARNING: failed to fetch team roster page for ${team.name} (id=${team.id})`);
      continue;
    }
    const inductees = parseExplorerResults(page.html, team.name);
    console.log(`  found ${inductees.length} inductee(s)`);
    for (const inductee of inductees) {
      if (bySlug.has(inductee.slug)) {
        duplicateCards += 1;
        continue;
      }
      bySlug.set(inductee.slug, inductee);
    }
  }
  const scraped = [...bySlug.values()];
  console.log(
    `\nTotal distinct inductees across ${NEGRO_LEAGUE_TEAM_OPTIONS.length} Negro League franchises: ${scraped.length}`,
  );

  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const existingLandscapeRes = await pool.query<ExistingLandscapeRow>(
    `SELECT display_name, canonical_url FROM bb_research.landscape_candidates WHERE lane = $1`,
    [LANE],
  );
  const existingEntitiesRes = await pool.query<ExistingEntity>(
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
  const netNewRows: {
    displayName: string;
    kind: string;
    canonicalUrl: string;
    sourceItemId: string;
    primaryTeam: string;
    classOf: string | null;
  }[] = [];

  for (const inductee of scraped) {
    const normalized = normalizeNameForDiff(inductee.displayName);
    if (existingLandscapeNames.has(normalized)) {
      dedupedOutLandscapeLane += 1;
      continue;
    }
    if (existingEntityNames.has(normalized)) {
      dedupedOutCanonicalEntityNames.push(inductee.displayName);
      continue;
    }
    const verified = await fetchPage(inductee.canonicalUrl);
    if (!verified) {
      urlFailedRows.push({
        displayName: inductee.displayName,
        canonicalUrl: inductee.canonicalUrl,
      });
      continue;
    }
    netNewRows.push({
      displayName: inductee.displayName,
      kind: 'person',
      canonicalUrl: inductee.canonicalUrl,
      sourceItemId: inductee.slug,
      primaryTeam: inductee.primaryTeam,
      classOf: inductee.classOf,
    });
  }

  const report: Report = {
    generatedAt: new Date().toISOString(),
    sourceUrl: EXPLORER_URL,
    sourceProgramId: SOURCE_PROGRAM_ID,
    sourceProgramName: SOURCE_PROGRAM_NAME,
    teamsQueried: NEGRO_LEAGUE_TEAM_OPTIONS.length,
    dryRun: DRY_RUN || !APPLY,
    counts: {
      scraped: scraped.length,
      dedupedOutDuplicateCard: duplicateCards,
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
    netNewRows.map((row) => ({
      name: row.displayName,
      kind: row.kind,
      canonical_url: row.canonicalUrl,
    })),
  );
  console.log(
    `\nCounts: scraped=${report.counts.scraped} ` +
      `duplicate-cards=${report.counts.dedupedOutDuplicateCard} ` +
      `deduped-out(lane)=${report.counts.dedupedOutLandscapeLane} ` +
      `deduped-out(canonical)=${report.counts.dedupedOutCanonicalEntities} ` +
      `url-failed=${report.counts.urlFailed} ` +
      `net-new=${report.counts.netNew}`,
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
  const reportPath = join(
    REPORT_DIR,
    `negro-leagues-hof-${report.generatedAt.replace(/[:.]/gu, '-')}.json`,
  );
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${reportPath}`);

  if (DRY_RUN || !APPLY) {
    console.log(
      '\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 NEGRO_LEAGUES_HOF_APPLY=1 to apply.',
    );
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const runId = `negro-leagues-hof-${report.generatedAt.slice(0, 10)}`;
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
        EXPLORER_URL,
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
            sourceUrl: row.canonicalUrl,
            capturedAt: report.generatedAt,
            primaryTeam: row.primaryTeam,
            classOf: row.classOf,
          }),
          JSON.stringify(row),
          report.generatedAt,
        ],
      );
    }
    await client.query('COMMIT');
    console.log(
      `Applied: upserted run ${runId} (lane='${RUN_LANE}'), inserted up to ${netNewRows.length} candidate row(s) (lane='${LANE}', ON CONFLICT DO NOTHING on (lane, source_item_id)).`,
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
