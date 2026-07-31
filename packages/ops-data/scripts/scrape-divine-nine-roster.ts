/**
 * Lane B / repo-bmmo — deterministic Divine Nine (NPHC) roster + founders scraper.
 *
 * Stages the nine National Pan-Hellenic Council ("Divine Nine") organizations
 * (kind='organization') and their individually-verified founders
 * (kind='person') into bb_research.landscape_candidates (lane='divine-nine').
 * No LLM anywhere.
 *
 * Unlike scrape-negro-leagues-hof-roster.ts / scrape-hbcu-roster-diff.ts,
 * there is no single machine-parseable listing page across all nine
 * organizations — each org publishes its own history/founders page, several
 * behind bot-detection (Cloudflare challenge pages, image-based responses)
 * that this pipeline's safe-fetch transport cannot get past. Because of that,
 * DIVINE_NINE_ROSTER below is a hardcoded candidate list, but every row is
 * still gated the same way the scraped-HTML scripts gate theirs: at runtime
 * this script re-fetches each row's own sourceUrl via fetchPage() and only
 * stages the row if the fetch succeeds AND the row's own displayName text
 * (or a documented alias) appears in the fetched page text. Rows that fail
 * that check are reported as urlFailed/nameNotFound and never staged — same
 * as a scraped row failing verification in the sibling scripts.
 *
 * Sourcing notes (as of 2026-07, verified by curl with a browser User-Agent
 * during construction of this dataset — see VERIFICATION_SOURCE per row):
 *   - Alpha Phi Alpha (apa1906.net/our-history/): org + all 7 Jewel founders
 *     confirmed present in fetched page text.
 *   - Alpha Kappa Alpha (aka1908.com/): org confirmed (name + "1908" present
 *     on the fetched homepage). The site's dedicated history/founders page
 *     returns a binary (non-HTML) bot-challenge response to this pipeline's
 *     fetcher, so individual AKA founder names could NOT be verified and are
 *     deliberately omitted — see UNVERIFIED_NAMES below.
 *   - Kappa Alpha Psi (kappaalphapsi1911.com): every page on this domain
 *     returned HTTP 403 (Cloudflare) to this pipeline's fetcher at
 *     construction time. Org and founders both omitted from the roster below
 *     and reported as unverified; the org row can be added once the page is
 *     reachable.
 *   - Omega Psi Phi (oppf.org/about-omega/): org + 3 undergraduate founders +
 *     faculty adviser Ernest Everett Just confirmed present.
 *   - Delta Sigma Theta (deltasigmatheta.org/): org confirmed (name + "1913"
 *     + "Howard University" present on the fetched homepage). No official
 *     page listing all 22 individual founders was reachable via this
 *     pipeline's fetcher at construction time; individual DST founders are
 *     omitted — see UNVERIFIED_NAMES below.
 *   - Phi Beta Sigma (phibetasigma1914.org/history/): org + all 3 founders
 *     confirmed present.
 *   - Zeta Phi Beta (zphib1920.org/about/founders-first-initiates/): org +
 *     all 5 founders confirmed present.
 *   - Sigma Gamma Rho (sgrho1922.org/her-story/): org + all 7 founders
 *     confirmed present.
 *   - Iota Phi Theta (iotaphitheta.org/founders/): org + all 12 founders
 *     confirmed present.
 *
 * Dedup: lane='divine-nine' has no prior rows (new lane), so the meaningful
 * diff is against bb_canonical.entities.display_name — several Divine Nine
 * founders or orgs may already be canonical entities in this dataset and
 * must not be re-staged.
 *
 * Default is dry-run (plan + report only, no database writes). Production
 * writes require:
 *   DRY_RUN=0 DIVINE_NINE_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/scrape-divine-nine-roster.ts
 *
 * Apply DB writes (after reviewing the dry-run report):
 *   DRY_RUN=0 DIVINE_NINE_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/scrape-divine-nine-roster.ts
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
const APPLY = process.env.DIVINE_NINE_APPLY === '1';

const SOURCE_PROGRAM_ID = 'nphc-divine-nine-official-sites';
const SOURCE_PROGRAM_NAME =
  'National Pan-Hellenic Council (Divine Nine) member organizations — official org history/founders pages';
const LANE = 'divine-nine';
/**
 * bb_research.source_program_runs.lane has a CHECK constraint restricted to
 * ('dc-sites','greenbook','hbcu','nrhp','wikidata','other') — 'divine-nine'
 * isn't a member, so the *run* row uses 'other' while every candidate row
 * still carries lane='divine-nine' (landscape_candidates.lane has no CHECK).
 */
const RUN_LANE = 'other';

type CandidateKind = 'organization' | 'person';

type RosterRow = {
  readonly displayName: string;
  readonly kind: CandidateKind;
  readonly sourceItemId: string;
  readonly sourceUrl: string;
  readonly description: string;
  readonly orgId: string;
  readonly orgName: string;
  readonly foundedYear: number;
  readonly foundedAt: string;
};

/**
 * Hardcoded, hand-verified Divine Nine roster. Every row's sourceUrl was
 * fetched (curl, browser User-Agent) during construction of this dataset and
 * confirmed both HTTP 200 and displayName-substring-present in the fetched
 * text. Names that could not be verified this way (see file header) are
 * intentionally excluded from this table and listed in UNVERIFIED_NAMES
 * instead, so nothing here is fabricated.
 */
const DIVINE_NINE_ROSTER: readonly RosterRow[] = [
  // --- Alpha Phi Alpha Fraternity, Inc. (1906, Cornell University) ---
  {
    displayName: 'Alpha Phi Alpha Fraternity, Inc.',
    kind: 'organization',
    sourceItemId: 'org-alpha-phi-alpha',
    sourceUrl: 'https://apa1906.net/our-history/',
    description:
      'First intercollegiate Greek-letter fraternity established for African Americans, founded December 4, 1906 at Cornell University.',
    orgId: 'org-alpha-phi-alpha',
    orgName: 'Alpha Phi Alpha Fraternity, Inc.',
    foundedYear: 1906,
    foundedAt: 'Cornell University',
  },
  ...[
    'Henry Arthur Callis',
    'Charles Henry Chapman',
    'Eugene Kinckle Jones',
    'George Biddle Kelley',
    'Nathaniel Allison Murray',
    'Robert Harold Ogle',
    'Vertner Woodson Tandy',
  ].map((name) => founderRow(name, 'apa', 'https://apa1906.net/our-history/', 'Alpha Phi Alpha Fraternity, Inc.', 1906, 'Cornell University')),

  // --- Alpha Kappa Alpha Sorority, Inc. (1908, Howard University) ---
  {
    displayName: 'Alpha Kappa Alpha Sorority, Inc.',
    kind: 'organization',
    sourceItemId: 'org-alpha-kappa-alpha',
    sourceUrl: 'https://aka1908.com/',
    description:
      'First Greek-letter organization established by African American college-educated women, founded January 15, 1908 at Howard University.',
    orgId: 'org-alpha-kappa-alpha',
    orgName: 'Alpha Kappa Alpha Sorority, Inc.',
    foundedYear: 1908,
    foundedAt: 'Howard University',
  },
  // AKA individual founders intentionally omitted — see UNVERIFIED_NAMES.

  // --- Kappa Alpha Psi Fraternity, Inc. (1911, Indiana University) ---
  // Org row and founders intentionally omitted — kappaalphapsi1911.com
  // returned HTTP 403 to this pipeline's fetcher on every path tried at
  // construction time. See UNVERIFIED_NAMES.

  // --- Omega Psi Phi Fraternity, Inc. (1911, Howard University) ---
  {
    displayName: 'Omega Psi Phi Fraternity, Inc.',
    kind: 'organization',
    sourceItemId: 'org-omega-psi-phi',
    sourceUrl: 'https://oppf.org/about-omega/',
    description:
      'Fraternity founded November 17, 1911 at Howard University by three undergraduates with their faculty adviser.',
    orgId: 'org-omega-psi-phi',
    orgName: 'Omega Psi Phi Fraternity, Inc.',
    foundedYear: 1911,
    foundedAt: 'Howard University',
  },
  ...['Edgar Amos Love', 'Oscar James Cooper', 'Frank Coleman', 'Ernest Everett Just'].map((name) =>
    founderRow(name, 'opp', 'https://oppf.org/about-omega/', 'Omega Psi Phi Fraternity, Inc.', 1911, 'Howard University'),
  ),

  // --- Delta Sigma Theta Sorority, Inc. (1913, Howard University) ---
  {
    displayName: 'Delta Sigma Theta Sorority, Inc.',
    kind: 'organization',
    sourceItemId: 'org-delta-sigma-theta',
    sourceUrl: 'https://www.deltasigmatheta.org/',
    description:
      'Sorority founded January 13, 1913 by 22 collegiate women at Howard University.',
    orgId: 'org-delta-sigma-theta',
    orgName: 'Delta Sigma Theta Sorority, Inc.',
    foundedYear: 1913,
    foundedAt: 'Howard University',
  },
  // DST's 22 individual founders intentionally omitted — no official page
  // listing all names was reachable via this pipeline's fetcher at
  // construction time. See UNVERIFIED_NAMES.

  // --- Phi Beta Sigma Fraternity, Inc. (1914, Howard University) ---
  {
    displayName: 'Phi Beta Sigma Fraternity, Inc.',
    kind: 'organization',
    sourceItemId: 'org-phi-beta-sigma',
    sourceUrl: 'https://phibetasigma1914.org/history/',
    description:
      'Fraternity founded January 9, 1914 at Howard University by three students.',
    orgId: 'org-phi-beta-sigma',
    orgName: 'Phi Beta Sigma Fraternity, Inc.',
    foundedYear: 1914,
    foundedAt: 'Howard University',
  },
  ...['A. Langston Taylor', 'Leonard F. Morse', 'Charles I. Brown'].map((name) =>
    founderRow(name, 'pbs', 'https://phibetasigma1914.org/history/', 'Phi Beta Sigma Fraternity, Inc.', 1914, 'Howard University'),
  ),

  // --- Zeta Phi Beta Sorority, Inc. (1920, Howard University) ---
  {
    displayName: 'Zeta Phi Beta Sorority, Inc.',
    kind: 'organization',
    sourceItemId: 'org-zeta-phi-beta',
    sourceUrl: 'https://zphib1920.org/history/',
    description: 'Sorority founded January 16, 1920 at Howard University.',
    orgId: 'org-zeta-phi-beta',
    orgName: 'Zeta Phi Beta Sorority, Inc.',
    foundedYear: 1920,
    foundedAt: 'Howard University',
  },
  ...['Arizona Cleaver Stemons', 'Pearl Anna Neal', 'Myrtle Tyler Faithful', 'Viola Tyler Goings', 'Fannie Pettie Watts'].map(
    (name) =>
      founderRow(
        name,
        'zpb',
        'https://zphib1920.org/about/founders-first-initiates/',
        'Zeta Phi Beta Sorority, Inc.',
        1920,
        'Howard University',
      ),
  ),

  // --- Sigma Gamma Rho Sorority, Inc. (1922, Butler University) ---
  {
    displayName: 'Sigma Gamma Rho Sorority, Inc.',
    kind: 'organization',
    sourceItemId: 'org-sigma-gamma-rho',
    sourceUrl: 'https://sgrho1922.org/her-story/',
    description:
      'Sorority founded November 12, 1922 in Indianapolis, Indiana by seven educators; chartered at Butler University in 1929.',
    orgId: 'org-sigma-gamma-rho',
    orgName: 'Sigma Gamma Rho Sorority, Inc.',
    foundedYear: 1922,
    foundedAt: 'Butler University',
  },
  ...[
    'Mary Lou Allison Gardner Little',
    'Dorothy Hanley Whiteside',
    'Vivian Irene White Marbury',
    'Nannie Mae Gahn Johnson',
    'Hattie Mae Annette Dulin Redford',
    'Bessie Mae Downey Rhoades Martin',
    'Cubena McClure',
  ].map((name) => founderRow(name, 'sgr', 'https://sgrho1922.org/her-story/', 'Sigma Gamma Rho Sorority, Inc.', 1922, 'Butler University')),

  // --- Iota Phi Theta Fraternity, Inc. (1963, Morgan State College) ---
  {
    displayName: 'Iota Phi Theta Fraternity, Inc.',
    kind: 'organization',
    sourceItemId: 'org-iota-phi-theta',
    sourceUrl: 'https://iotaphitheta.org/founders/',
    description:
      'Fraternity founded September 19, 1963 at Morgan State College by twelve students.',
    orgId: 'org-iota-phi-theta',
    orgName: 'Iota Phi Theta Fraternity, Inc.',
    foundedYear: 1963,
    foundedAt: 'Morgan State College',
  },
  ...[
    'Albert Hicks',
    'Lonnie Spruill, Jr.',
    'Charles Briscoe',
    'Frank Coakley',
    'John Slade',
    'Barron Willis',
    'Webster Lewis',
    'Charles Brown',
    'Lewis Hudnell',
    'Charles Gregory',
    'Elias Dorsey, Jr.',
    'Michael Williams',
  ].map((name) =>
    founderRow(name, 'iota', 'https://iotaphitheta.org/founders/', 'Iota Phi Theta Fraternity, Inc.', 1963, 'Morgan State College'),
  ),
];

function founderRow(
  name: string,
  orgSlug: string,
  sourceUrl: string,
  orgName: string,
  foundedYear: number,
  foundedAt: string,
): RosterRow {
  return {
    displayName: name,
    kind: 'person',
    sourceItemId: `person-${orgSlug}-${slugify(name)}`,
    sourceUrl,
    description: `Founder of ${orgName} (${foundedYear}, ${foundedAt}).`,
    orgId: `org-${orgSlug}`,
    orgName,
    foundedYear,
    foundedAt,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

/**
 * Names researched from each org's official history page but that this
 * pipeline's fetcher could not independently verify (bot-blocked page, or
 * no reachable page enumerating all names). Reported in the dry-run summary
 * so the operator knows exactly what was left out and why — never staged.
 */
const UNVERIFIED_NAMES: readonly { readonly org: string; readonly name: string; readonly reason: string }[] = [
  {
    org: 'Alpha Kappa Alpha Sorority, Inc.',
    name: 'Ethel Hedgeman Lyle (and 15 other 1908 founders)',
    reason:
      "aka1908.com's history/founders page returns a non-HTML bot-challenge response to this pipeline's fetcher; individual founder names could not be confirmed present in fetched text.",
  },
  {
    org: 'Kappa Alpha Psi Fraternity, Inc.',
    name: 'Elder Watson Diggs (and 9 other 1911 founders)',
    reason:
      "kappaalphapsi1911.com returned HTTP 403 (Cloudflare) on every path tried by this pipeline's fetcher; org and founders both omitted pending a reachable source.",
  },
  {
    org: 'Delta Sigma Theta Sorority, Inc.',
    name: '22 named founders (e.g. Osceola Macarthy Adams, Bertha Pitts Campbell)',
    reason:
      "No page on deltasigmatheta.org enumerating all 22 individual founders was reachable via this pipeline's fetcher at construction time; only the org-level founding fact (1913, Howard University) was verified on the homepage.",
  },
];

function stripTags(html: string): string {
  return html
    // `[^>]*` after the end-tag name: an end tag runs to the first `>`, so `</script >` and
    // `</script\t\n bar>` close the element and browsers honour both. A stricter pattern leaves
    // the element's contents in the extracted text (CodeQL js/bad-tag-filter).
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\b[^>]*>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ');
}

/** Suffix/legal tokens that pages routinely drop or restyle. */
const NAME_CHECK_DROP_TOKENS = new Set(['inc', 'jr', 'sr', 'the']);

/**
 * Runtime name-presence gate: every significant token of the row's
 * displayName must appear in the fetched page text, else the row is treated
 * exactly like a failed fetch and never staged. This is the enforcement of
 * the "no fabrication" rule — the hardcoded roster is only trusted as far as
 * the live page still backs it.
 */
function pageNamesRow(displayName: string, pageHtml: string): boolean {
  const pageTokens = new Set(normalizeNameForDiff(stripTags(pageHtml)).split(' '));
  const nameTokens = normalizeNameForDiff(displayName)
    .split(' ')
    .filter((token) => token.length > 1 && !NAME_CHECK_DROP_TOKENS.has(token));
  if (nameTokens.length === 0) return false;
  return nameTokens.every((token) => pageTokens.has(token));
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
type ExistingLandscapeRow = { readonly display_name: string; readonly canonical_url: string | null };

type Report = {
  readonly generatedAt: string;
  readonly sourceProgramId: string;
  readonly sourceProgramName: string;
  readonly dryRun: boolean;
  readonly counts: {
    readonly rosterRows: number;
    readonly orgs: number;
    readonly founders: number;
    readonly dedupedOutLandscapeLane: number;
    readonly dedupedOutCanonicalEntities: number;
    readonly urlFailed: number;
    readonly netNew: number;
  };
  readonly netNewRows: readonly {
    readonly displayName: string;
    readonly kind: CandidateKind;
    readonly sourceUrl: string;
    readonly sourceItemId: string;
    readonly orgName: string;
  }[];
  readonly urlFailedRows: readonly { readonly displayName: string; readonly sourceUrl: string }[];
  readonly dedupedOutCanonicalEntityNames: readonly string[];
  readonly unverifiedNames: typeof UNVERIFIED_NAMES;
};

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');

  console.log(
    `Divine Nine hardcoded roster: ${DIVINE_NINE_ROSTER.length} row(s) ` +
      `(${DIVINE_NINE_ROSTER.filter((r) => r.kind === 'organization').length} orgs, ` +
      `${DIVINE_NINE_ROSTER.filter((r) => r.kind === 'person').length} founders).`,
  );
  console.log(`Unverified/omitted names: ${UNVERIFIED_NAMES.length} (see report).`);

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
  const urlFailedRows: { displayName: string; sourceUrl: string }[] = [];
  const netNewRows: {
    displayName: string;
    kind: CandidateKind;
    sourceUrl: string;
    sourceItemId: string;
    orgName: string;
  }[] = [];

  for (const row of DIVINE_NINE_ROSTER) {
    const normalized = normalizeNameForDiff(row.displayName);
    if (existingLandscapeNames.has(normalized)) {
      dedupedOutLandscapeLane += 1;
      continue;
    }
    if (existingEntityNames.has(normalized)) {
      dedupedOutCanonicalEntityNames.push(row.displayName);
      continue;
    }
    console.log(`Verifying ${row.displayName}: ${row.sourceUrl}`);
    const verified = await fetchPage(row.sourceUrl);
    if (!verified || !pageNamesRow(row.displayName, verified.html)) {
      urlFailedRows.push({ displayName: row.displayName, sourceUrl: row.sourceUrl });
      continue;
    }
    netNewRows.push({
      displayName: row.displayName,
      kind: row.kind,
      sourceUrl: row.sourceUrl,
      sourceItemId: row.sourceItemId,
      orgName: row.orgName,
    });
  }

  const report: Report = {
    generatedAt: new Date().toISOString(),
    sourceProgramId: SOURCE_PROGRAM_ID,
    sourceProgramName: SOURCE_PROGRAM_NAME,
    dryRun: DRY_RUN || !APPLY,
    counts: {
      rosterRows: DIVINE_NINE_ROSTER.length,
      orgs: DIVINE_NINE_ROSTER.filter((r) => r.kind === 'organization').length,
      founders: DIVINE_NINE_ROSTER.filter((r) => r.kind === 'person').length,
      dedupedOutLandscapeLane,
      dedupedOutCanonicalEntities: dedupedOutCanonicalEntityNames.length,
      urlFailed: urlFailedRows.length,
      netNew: netNewRows.length,
    },
    netNewRows,
    urlFailedRows,
    dedupedOutCanonicalEntityNames,
    unverifiedNames: UNVERIFIED_NAMES,
  };

  console.log('\nWould-be-staged rows (net-new):');
  console.table(
    netNewRows.map((row) => ({ name: row.displayName, kind: row.kind, org: row.orgName, source_url: row.sourceUrl })),
  );
  console.log(
    `\nCounts: rosterRows=${report.counts.rosterRows} orgs=${report.counts.orgs} founders=${report.counts.founders} ` +
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
  console.log('\nUnverified names (never included in roster, never staged):');
  console.table(UNVERIFIED_NAMES);

  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = join(REPORT_DIR, `divine-nine-roster-${report.generatedAt.replace(/[:.]/gu, '-')}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${reportPath}`);

  if (DRY_RUN || !APPLY) {
    console.log('\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 DIVINE_NINE_APPLY=1 to apply.');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const runId = `divine-nine-${report.generatedAt.slice(0, 10)}`;
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
        'https://en.wikipedia.org/wiki/National_Pan-Hellenic_Council',
        report.generatedAt,
        report.counts.rosterRows,
        report.counts.netNew,
        report.counts.rosterRows - report.counts.netNew,
        JSON.stringify(report.counts),
      ],
    );
    for (const row of netNewRows) {
      const id = `${LANE}-${row.sourceItemId}`;
      const sourceRow = DIVINE_NINE_ROSTER.find((r) => r.sourceItemId === row.sourceItemId)!;
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
          sourceRow.description,
          null,
          null,
          row.sourceUrl,
          JSON.stringify({
            sourceId: SOURCE_PROGRAM_ID,
            sourceUrl: row.sourceUrl,
            capturedAt: report.generatedAt,
            orgId: sourceRow.orgId,
            orgName: sourceRow.orgName,
            foundedYear: sourceRow.foundedYear,
            foundedAt: sourceRow.foundedAt,
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
