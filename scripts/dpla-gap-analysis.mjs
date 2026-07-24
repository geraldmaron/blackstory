/**
 * One-shot DPLA bulk gap analysis (offline).
 *
 * Compares a sample or full DPLA item export against a BlackStory catalog entity list and
 * reports states and decades where DPLA holds material but the corpus is thin or absent.
 * Designed for fixture-first runs in CI and local dev; real bulk exports are analyzed on
 * disk outside Supabase — never mirrored continuously into Postgres.
 *
 * Usage:
 *   node scripts/dpla-gap-analysis.mjs
 *   node scripts/dpla-gap-analysis.mjs --dpla /path/to/dpla.json --corpus /path/to/corpus.json
 *   node scripts/dpla-gap-analysis.mjs --out docs/research/dpla-gap-sample-report.md --json .cache/dpla-gap/report.json
 *   node scripts/dpla-gap-analysis.mjs --completeness   # also run the live-DB sections (see below)
 *
 * Extended sections (repo-xez5.6b): beyond the DPLA-vs-corpus state x decade gap above, this
 * script also reports three DB-backed sections and one static-catalog section:
 *   1. Per-entity field completeness (bb_public.release_entities blank-field audit — same
 *      methodology as docs/research/entity-completeness-audit.md §1-2).
 *   2. Figure-category coverage vs a Civil Rights Movement leader reference roster.
 *   3. Theme-impact evidence sufficiency (packages/domain/src/statistics/theme-impact-questions.ts).
 *   4. Decade coverage of canonical PERSON entities' claims (bb_canonical.claim_versions, not
 *      just DPLA items/places).
 * Sections 1, 2, and 4 need a live Postgres connection (this script is otherwise fully offline
 * and fixture-driven, per the file header above). By default they render from a dated, cited
 * snapshot (`DB_SNAPSHOT`, generated 2026-07-24 via the Supabase project twykhihqkcldpreuovay
 * MCP `execute_sql` tool — see snapshot queries inline below) so a bare `node
 * scripts/dpla-gap-analysis.mjs` run always completes offline and deterministically. Pass
 * `--completeness` with `DATABASE_URL` (or `APP_DATABASE_URL`) set and the `pg` package
 * resolvable (as in apps/api-public, which already depends on it) to re-run them live instead;
 * on any failure (missing driver, missing env, network) this script logs a warning and falls
 * back to the snapshot rather than crashing.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const defaultDplaPath = join(
  repoRoot,
  'packages/domain/src/adapters/dpla/fixtures/gap-analysis-dpla-sample.json',
);
const defaultCorpusPath = join(
  repoRoot,
  'packages/domain/src/adapters/dpla/fixtures/gap-analysis-corpus-sample.json',
);
const defaultOutPath = join(repoRoot, 'docs/research/dpla-gap-sample-report.md');
const defaultJsonPath = join(repoRoot, '.cache/dpla-gap/report.json');

/** @typedef {{ postalCode: string, name: string }} UsStateRef */

/** @type {readonly UsStateRef[]} */
const US_STATES = [
  { postalCode: 'AL', name: 'Alabama' },
  { postalCode: 'AK', name: 'Alaska' },
  { postalCode: 'AZ', name: 'Arizona' },
  { postalCode: 'AR', name: 'Arkansas' },
  { postalCode: 'CA', name: 'California' },
  { postalCode: 'CO', name: 'Colorado' },
  { postalCode: 'CT', name: 'Connecticut' },
  { postalCode: 'DE', name: 'Delaware' },
  { postalCode: 'DC', name: 'District of Columbia' },
  { postalCode: 'FL', name: 'Florida' },
  { postalCode: 'GA', name: 'Georgia' },
  { postalCode: 'HI', name: 'Hawaii' },
  { postalCode: 'ID', name: 'Idaho' },
  { postalCode: 'IL', name: 'Illinois' },
  { postalCode: 'IN', name: 'Indiana' },
  { postalCode: 'IA', name: 'Iowa' },
  { postalCode: 'KS', name: 'Kansas' },
  { postalCode: 'KY', name: 'Kentucky' },
  { postalCode: 'LA', name: 'Louisiana' },
  { postalCode: 'ME', name: 'Maine' },
  { postalCode: 'MD', name: 'Maryland' },
  { postalCode: 'MA', name: 'Massachusetts' },
  { postalCode: 'MI', name: 'Michigan' },
  { postalCode: 'MN', name: 'Minnesota' },
  { postalCode: 'MS', name: 'Mississippi' },
  { postalCode: 'MO', name: 'Missouri' },
  { postalCode: 'MT', name: 'Montana' },
  { postalCode: 'NE', name: 'Nebraska' },
  { postalCode: 'NV', name: 'Nevada' },
  { postalCode: 'NH', name: 'New Hampshire' },
  { postalCode: 'NJ', name: 'New Jersey' },
  { postalCode: 'NM', name: 'New Mexico' },
  { postalCode: 'NY', name: 'New York' },
  { postalCode: 'NC', name: 'North Carolina' },
  { postalCode: 'ND', name: 'North Dakota' },
  { postalCode: 'OH', name: 'Ohio' },
  { postalCode: 'OK', name: 'Oklahoma' },
  { postalCode: 'OR', name: 'Oregon' },
  { postalCode: 'PA', name: 'Pennsylvania' },
  { postalCode: 'RI', name: 'Rhode Island' },
  { postalCode: 'SC', name: 'South Carolina' },
  { postalCode: 'SD', name: 'South Dakota' },
  { postalCode: 'TN', name: 'Tennessee' },
  { postalCode: 'TX', name: 'Texas' },
  { postalCode: 'UT', name: 'Utah' },
  { postalCode: 'VT', name: 'Vermont' },
  { postalCode: 'VA', name: 'Virginia' },
  { postalCode: 'WA', name: 'Washington' },
  { postalCode: 'WV', name: 'West Virginia' },
  { postalCode: 'WI', name: 'Wisconsin' },
  { postalCode: 'WY', name: 'Wyoming' },
];

const STATE_BY_POSTAL = new Map(US_STATES.map((state) => [state.postalCode, state]));
const STATE_BY_NAME = new Map(US_STATES.map((state) => [state.name.toLowerCase(), state]));

/**
 * @param {string} name
 * @returns {string | undefined}
 */
function readArgFlag(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const dplaPath = readArgFlag('--dpla') ?? defaultDplaPath;
const corpusPath = readArgFlag('--corpus') ?? defaultCorpusPath;
const outPath = readArgFlag('--out') ?? defaultOutPath;
const jsonPath = readArgFlag('--json') ?? defaultJsonPath;
const coverageThreshold = Number(readArgFlag('--coverage-threshold') ?? '0.15');
const wantsLiveCompleteness = process.argv.includes('--completeness');
const themeImpactQuestionsPath = join(
  repoRoot,
  'packages/domain/src/statistics/theme-impact-questions.ts',
);

/**
 * @param {string} absolutePath
 * @returns {string}
 */
function displayPath(absolutePath) {
  const normalizedRoot = `${repoRoot}/`;
  return absolutePath.startsWith(normalizedRoot)
    ? absolutePath.slice(normalizedRoot.length)
    : absolutePath;
}

/**
 * @param {unknown} raw
 * @returns {unknown[]}
 */
function loadJsonArray(raw) {
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.docs)) return parsed.docs;
  throw new Error('Expected a JSON array or an object with a docs[] field');
}

/**
 * @param {string | undefined} value
 * @returns {number | undefined}
 */
function yearFrom(value) {
  if (!value) return undefined;
  const match = /-?\d{1,4}/.exec(value);
  if (!match) return undefined;
  const year = Number.parseInt(match[0], 10);
  return Number.isFinite(year) ? year : undefined;
}

/**
 * @param {number} year
 * @returns {string}
 */
function decadeFromYear(year) {
  return `${Math.floor(year / 10) * 10}s`;
}

/**
 * @param {string} text
 * @returns {string | undefined}
 */
function postalFromText(text) {
  const haystack = text.toLowerCase();
  for (const state of US_STATES) {
    if (haystack.includes(state.name.toLowerCase())) return state.postalCode;
  }
  const postalMatch = /\b([A-Z]{2})\b/.exec(text);
  if (postalMatch && STATE_BY_POSTAL.has(postalMatch[1])) return postalMatch[1];
  return undefined;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function collectStrings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

/**
 * @param {Record<string, unknown>} item
 * @returns {{ state?: string, decades: string[], dateLabel?: string }}
 */
function extractDplaFacets(item) {
  const sourceResource =
    item.sourceResource && typeof item.sourceResource === 'object'
      ? /** @type {Record<string, unknown>} */ (item.sourceResource)
      : {};

  const dateCandidates = [
    ...collectStrings(sourceResource.date),
    ...collectStrings(item.date),
    ...collectStrings(sourceResource.temporal),
  ];
  const dateLabel = dateCandidates.find((value) => yearFrom(value) !== undefined);

  const decades = new Set();
  for (const candidate of dateCandidates) {
    const year = yearFrom(candidate);
    if (year !== undefined) decades.add(decadeFromYear(year));
  }

  const spatial =
    item.spatial && typeof item.spatial === 'object'
      ? /** @type {Record<string, unknown>} */ (item.spatial)
      : undefined;
  const spatialState =
    typeof spatial?.state === 'string'
      ? spatial.state
      : typeof spatial?.name === 'string'
        ? spatial.name
        : undefined;

  const textParts = [
    ...collectStrings(sourceResource.title),
    ...collectStrings(sourceResource.description),
    ...collectStrings(sourceResource.subject),
    ...collectStrings(item.dataProvider),
    ...collectStrings(item.provider),
    spatialState ?? '',
  ];
  const state =
    (spatialState && normalizeStateToken(spatialState)) ||
    postalFromText(textParts.join(' '));

  return {
    ...(state ? { state } : {}),
    decades: [...decades],
    ...(dateLabel ? { dateLabel } : {}),
  };
}

/**
 * @param {string} token
 * @returns {string | undefined}
 */
function normalizeStateToken(token) {
  const trimmed = token.trim();
  if (!trimmed) return undefined;
  const upper = trimmed.toUpperCase();
  if (STATE_BY_POSTAL.has(upper)) return upper;
  const byName = STATE_BY_NAME.get(trimmed.toLowerCase());
  return byName?.postalCode;
}

/**
 * @param {Record<string, unknown>} entity
 * @returns {{ state?: string, decades: string[] }}
 */
function extractCorpusFacets(entity) {
  const decades = new Set(
    Array.isArray(entity.eraBuckets)
      ? entity.eraBuckets.filter((value) => typeof value === 'string')
      : [],
  );

  const textParts = [
    ...collectStrings(entity.jurisdictionLabel),
    ...collectStrings(entity.locationLabel),
    ...collectStrings(entity.keywords),
    ...collectStrings(entity.displayName),
  ];
  const state = postalFromText(textParts.join(' '));

  return {
    ...(state ? { state } : {}),
    decades: [...decades],
  };
}

/**
 * @returns {Map<string, number>}
 */
function emptyCountMap() {
  return new Map();
}

/**
 * @param {Map<string, number>} map
 * @param {string | undefined} key
 * @param {number} [delta=1]
 */
function increment(map, key, delta = 1) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + delta);
}

/**
 * @param {Map<string, number>} map
 * @returns {Record<string, number>}
 */
function mapToObject(map) {
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * @param {number} dplaCount
 * @param {number} corpusCount
 * @returns {number}
 */
function coverageRatio(dplaCount, corpusCount) {
  if (dplaCount <= 0) return 1;
  return corpusCount / dplaCount;
}

/**
 * @param {Record<string, unknown>[]} dplaItems
 * @param {Record<string, unknown>[]} corpusEntities
 */
function analyzeGap(dplaItems, corpusEntities) {
  const dplaStates = emptyCountMap();
  const corpusStates = emptyCountMap();
  const dplaDecades = emptyCountMap();
  const corpusDecades = emptyCountMap();
  const dplaMatrix = new Map();
  const corpusMatrix = new Map();

  const dplaUnlocated = [];
  const dplaUndated = [];

  for (const item of dplaItems) {
    const facets = extractDplaFacets(item);
    increment(dplaStates, facets.state);
    if (!facets.state) {
      dplaUnlocated.push(String(item.id ?? item.stableIdentifier ?? 'unknown'));
    }
    if (facets.decades.length === 0) {
      dplaUndated.push(String(item.id ?? item.stableIdentifier ?? 'unknown'));
    }
    for (const decade of facets.decades) {
      increment(dplaDecades, decade);
      const matrixKey = facets.state ? `${facets.state}:${decade}` : undefined;
      increment(dplaMatrix, matrixKey);
    }
  }

  for (const entity of corpusEntities) {
    const facets = extractCorpusFacets(entity);
    increment(corpusStates, facets.state);
    for (const decade of facets.decades) {
      increment(corpusDecades, decade);
      const matrixKey = facets.state ? `${facets.state}:${decade}` : undefined;
      increment(corpusMatrix, matrixKey);
    }
  }

  /** @type {Array<{ postalCode: string, name: string, dplaCount: number, corpusCount: number, coverage: number }>} */
  const underrepresentedStates = [];
  for (const [postalCode, dplaCount] of dplaStates.entries()) {
    const corpusCount = corpusStates.get(postalCode) ?? 0;
    const coverage = coverageRatio(dplaCount, corpusCount);
    if (dplaCount > 0 && coverage < coverageThreshold) {
      underrepresentedStates.push({
        postalCode,
        name: STATE_BY_POSTAL.get(postalCode)?.name ?? postalCode,
        dplaCount,
        corpusCount,
        coverage,
      });
    }
  }
  underrepresentedStates.sort((a, b) => a.coverage - b.coverage || b.dplaCount - a.dplaCount);

  /** @type {Array<{ decade: string, dplaCount: number, corpusCount: number, coverage: number }>} */
  const underrepresentedDecades = [];
  for (const [decade, dplaCount] of dplaDecades.entries()) {
    const corpusCount = corpusDecades.get(decade) ?? 0;
    const coverage = coverageRatio(dplaCount, corpusCount);
    if (dplaCount > 0 && coverage < coverageThreshold) {
      underrepresentedDecades.push({ decade, dplaCount, corpusCount, coverage });
    }
  }
  underrepresentedDecades.sort((a, b) => a.coverage - b.coverage || b.dplaCount - a.dplaCount);

  /** @type {Array<{ key: string, postalCode: string, decade: string, dplaCount: number, corpusCount: number, coverage: number }>} */
  const underrepresentedCells = [];
  for (const [key, dplaCount] of dplaMatrix.entries()) {
    if (!key) continue;
    const [postalCode, decade] = key.split(':');
    const corpusCount = corpusMatrix.get(key) ?? 0;
    const coverage = coverageRatio(dplaCount, corpusCount);
    if (dplaCount > 0 && coverage < coverageThreshold) {
      underrepresentedCells.push({
        key,
        postalCode,
        decade,
        dplaCount,
        corpusCount,
        coverage,
      });
    }
  }
  underrepresentedCells.sort((a, b) => a.coverage - b.coverage || b.dplaCount - a.dplaCount);

  return {
    inputs: {
      dplaCount: dplaItems.length,
      corpusCount: corpusEntities.length,
      coverageThreshold,
    },
    counts: {
      dplaStates: mapToObject(dplaStates),
      corpusStates: mapToObject(corpusStates),
      dplaDecades: mapToObject(dplaDecades),
      corpusDecades: mapToObject(corpusDecades),
    },
    gaps: {
      underrepresentedStates,
      underrepresentedDecades,
      underrepresentedCells,
    },
    diagnostics: {
      dplaUnlocated,
      dplaUndated,
    },
  };
}

/**
 * @param {ReturnType<typeof analyzeGap>} report
 * @param {{ dplaPath: string, corpusPath: string, generatedAt: string }} meta
 */
function renderMarkdown(report, meta) {
  const lines = [];
  lines.push('<!-- Generated by scripts/dpla-gap-analysis.mjs — do not hand-edit. -->');
  lines.push('');
  lines.push('# DPLA bulk gap analysis — sample report');
  lines.push('');
  lines.push(`**Generated:** ${meta.generatedAt}`);
  lines.push(`**DPLA input:** \`${displayPath(meta.dplaPath)}\``);
  lines.push(`**Corpus input:** \`${displayPath(meta.corpusPath)}\``);
  lines.push(`**Coverage threshold:** ${report.inputs.coverageThreshold * 100}% (corpus ÷ DPLA)`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- DPLA items analyzed: **${report.inputs.dplaCount}**`);
  lines.push(`- BlackStory entities analyzed: **${report.inputs.corpusCount}**`);
  lines.push(
    `- Underrepresented states: **${report.gaps.underrepresentedStates.length}** (DPLA > 0, coverage < threshold)`,
  );
  lines.push(
    `- Underrepresented decades: **${report.gaps.underrepresentedDecades.length}**`,
  );
  lines.push(
    `- Underrepresented state×decade cells: **${report.gaps.underrepresentedCells.length}**`,
  );
  lines.push('');

  lines.push('## Underrepresented states');
  lines.push('');
  if (report.gaps.underrepresentedStates.length === 0) {
    lines.push('_None at this threshold._');
  } else {
    lines.push('| State | DPLA items | Corpus entities | Coverage |');
    lines.push('|---|---:|---:|---:|');
    for (const row of report.gaps.underrepresentedStates) {
      lines.push(
        `| ${row.name} (${row.postalCode}) | ${row.dplaCount} | ${row.corpusCount} | ${(row.coverage * 100).toFixed(1)}% |`,
      );
    }
  }
  lines.push('');

  lines.push('## Underrepresented decades');
  lines.push('');
  if (report.gaps.underrepresentedDecades.length === 0) {
    lines.push('_None at this threshold._');
  } else {
    lines.push('| Decade | DPLA items | Corpus entities | Coverage |');
    lines.push('|---|---:|---:|---:|');
    for (const row of report.gaps.underrepresentedDecades) {
      lines.push(
        `| ${row.decade} | ${row.dplaCount} | ${row.corpusCount} | ${(row.coverage * 100).toFixed(1)}% |`,
      );
    }
  }
  lines.push('');

  lines.push('## Underrepresented state × decade cells (top 15)');
  lines.push('');
  if (report.gaps.underrepresentedCells.length === 0) {
    lines.push('_None at this threshold._');
  } else {
    lines.push('| State | Decade | DPLA items | Corpus entities | Coverage |');
    lines.push('|---|---|---:|---:|---:|');
    for (const row of report.gaps.underrepresentedCells.slice(0, 15)) {
      const stateName = STATE_BY_POSTAL.get(row.postalCode)?.name ?? row.postalCode;
      lines.push(
        `| ${stateName} (${row.postalCode}) | ${row.decade} | ${row.dplaCount} | ${row.corpusCount} | ${(row.coverage * 100).toFixed(1)}% |`,
      );
    }
  }
  lines.push('');

  lines.push('## Diagnostics');
  lines.push('');
  lines.push(
    `- DPLA items without a resolved U.S. state: **${report.diagnostics.dplaUnlocated.length}**`,
  );
  lines.push(`- DPLA items without a resolved decade: **${report.diagnostics.dplaUndated.length}**`);
  lines.push('');
  lines.push('## Raw counts');
  lines.push('');
  lines.push('### DPLA by state');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(report.counts.dplaStates, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('### Corpus by state');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(report.counts.corpusStates, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('### DPLA by decade');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(report.counts.dplaDecades, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('### Corpus by decade');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(report.counts.corpusDecades, null, 2));
  lines.push('```');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

/**
 * Dated snapshot of the four live-DB numbers below, generated 2026-07-24 against the Supabase
 * project `twykhihqkcldpreuovay` via the `execute_sql` MCP tool (no data written; read-only).
 * Serves as the offline default for a fixture-first script; superseded by `--completeness` when
 * a live Postgres connection is available. Re-run the SQL in each section's `sourceQuery` field
 * to refresh.
 */
const DB_SNAPSHOT = {
  generatedAt: '2026-07-24',
  source: 'supabase:twykhihqkcldpreuovay (bb_public.release_entities active release; bb_canonical)',
  entityCompletenessByKind: [
    { kind: 'place', n: 565, blankSummary: 0, blankLocation: 0, blankGeo: 0, blankClaims: 0, blankRelated: 208, blankPrimaryImage: 551, blankTaxonomy: 0, blankHistoricalContext: 208, blankEraBuckets: 202 },
    { kind: 'person', n: 394, blankSummary: 0, blankLocation: 0, blankGeo: 0, blankClaims: 0, blankRelated: 0, blankPrimaryImage: 280, blankTaxonomy: 0, blankHistoricalContext: 0, blankEraBuckets: 1 },
    { kind: 'event', n: 79, blankSummary: 0, blankLocation: 0, blankGeo: 0, blankClaims: 0, blankRelated: 0, blankPrimaryImage: 77, blankTaxonomy: 0, blankHistoricalContext: 0, blankEraBuckets: 0 },
    { kind: 'institution', n: 79, blankSummary: 0, blankLocation: 0, blankGeo: 0, blankClaims: 0, blankRelated: 0, blankPrimaryImage: 75, blankTaxonomy: 0, blankHistoricalContext: 0, blankEraBuckets: 0 },
    { kind: 'school', n: 77, blankSummary: 0, blankLocation: 0, blankGeo: 0, blankClaims: 0, blankRelated: 0, blankPrimaryImage: 69, blankTaxonomy: 0, blankHistoricalContext: 0, blankEraBuckets: 12 },
    { kind: 'organization', n: 57, blankSummary: 0, blankLocation: 0, blankGeo: 0, blankClaims: 0, blankRelated: 0, blankPrimaryImage: 57, blankTaxonomy: 0, blankHistoricalContext: 0, blankEraBuckets: 0 },
    { kind: 'case', n: 48, blankSummary: 0, blankLocation: 0, blankGeo: 0, blankClaims: 0, blankRelated: 0, blankPrimaryImage: 48, blankTaxonomy: 0, blankHistoricalContext: 0, blankEraBuckets: 0 },
    { kind: 'law', n: 26, blankSummary: 0, blankLocation: 0, blankGeo: 0, blankClaims: 0, blankRelated: 0, blankPrimaryImage: 22, blankTaxonomy: 0, blankHistoricalContext: 0, blankEraBuckets: 0 },
    { kind: 'publication', n: 21, blankSummary: 0, blankLocation: 0, blankGeo: 0, blankClaims: 0, blankRelated: 0, blankPrimaryImage: 21, blankTaxonomy: 0, blankHistoricalContext: 0, blankEraBuckets: 0 },
    { kind: 'movement', n: 15, blankSummary: 0, blankLocation: 0, blankGeo: 0, blankClaims: 0, blankRelated: 0, blankPrimaryImage: 15, blankTaxonomy: 0, blankHistoricalContext: 0, blankEraBuckets: 0 },
    { kind: 'other', n: 14, blankSummary: 0, blankLocation: 0, blankGeo: 0, blankClaims: 0, blankRelated: 0, blankPrimaryImage: 14, blankTaxonomy: 0, blankHistoricalContext: 0, blankEraBuckets: 0 },
  ],
  entityCompletenessSourceQuery: `
    with active as (select release_id from bb_public.active_release limit 1),
    r as (select re.* from bb_public.release_entities re, active a where re.release_id = a.release_id)
    select kind, count(*) n,
      count(*) filter (where coalesce(summary,'')='') blank_summary,
      count(*) filter (where location is null) blank_location,
      count(*) filter (where lat is null or lng is null) blank_geo,
      count(*) filter (where claims is null or (jsonb_typeof(claims)='array' and jsonb_array_length(claims)=0)) blank_claims,
      count(*) filter (where related is null or (jsonb_typeof(related)='array' and jsonb_array_length(related)=0)) blank_related,
      count(*) filter (where primary_image is null) blank_primary_image,
      count(*) filter (where taxonomy is null or (jsonb_typeof(taxonomy)='array' and jsonb_array_length(taxonomy)=0)) blank_taxonomy,
      count(*) filter (where coalesce(projection->>'historicalContext','')='') blank_historicalContext,
      count(*) filter (where projection->'eraBuckets' is null or (jsonb_typeof(projection->'eraBuckets')='array' and jsonb_array_length(projection->'eraBuckets')=0)) blank_eraBuckets
    from r group by kind order by n desc;
  `.trim(),
  civilRightsRosterPresence: [
    { name: 'Amelia Boynton Robinson', present: true },
    { name: 'Andrew Young', present: true },
    { name: 'Bayard Rustin', present: true },
    { name: 'C.T. Vivian', present: true },
    { name: 'Diane Nash', present: true },
    { name: 'Ella Baker', present: true },
    { name: 'Fannie Lou Hamer', present: true },
    { name: 'Fred Shuttlesworth', present: true },
    { name: 'Hosea Williams', present: true },
    { name: 'James Bevel', present: true },
    { name: 'James Meredith', present: true },
    { name: 'John Lewis', present: true },
    { name: 'Julian Bond', present: true },
    { name: 'Malcolm X', present: true },
    { name: 'Martin Luther King Jr.', present: true },
    { name: 'Ralph Abernathy', present: true },
    { name: 'Stokely Carmichael', present: true, note: 'stored as "Stokely Carmichael (Kwame Ture)"' },
    { name: 'Wyatt Tee Walker', present: true },
    { name: 'A. Philip Randolph', present: false },
    { name: 'Claudette Colvin', present: false },
    { name: 'Coretta Scott King', present: false },
    { name: 'Dorothy Height', present: false },
    { name: 'Fred Hampton', present: false },
    { name: 'James Farmer', present: false },
    { name: 'Jesse Jackson', present: false },
    { name: 'Jo Ann Robinson', present: false },
    { name: 'Medgar Evers', present: false, note: 'a "Medgar and Myrlie Evers Home National Monument" place entity exists, but no person entity' },
    { name: 'Rosa Parks', present: false, note: '"Rosa Parks Museum"/"Rosa Parks Arrest Site" place entities exist, but no person entity' },
    { name: 'Roy Wilkins', present: false },
    { name: 'Whitney M. Young, Jr.', present: false },
  ],
  civilRightsRosterSourceQuery: `
    select r.name, e.display_name is not null as present
    from (values ('Martin Luther King Jr.'), ('Rosa Parks'), (...)) as r(name)
    left join bb_canonical.entities e on lower(e.display_name) like '%' || lower(r.name) || '%';
  `.trim(),
  personDecadeCoverage: {
    totalPersonEntities: 394,
    personsWithAtLeastOneDatedClaim: 343,
    byDecade: [
      { decade: '1700s', personCount: 1, claimCount: 1 },
      { decade: '1720s', personCount: 1, claimCount: 1 },
      { decade: '1770s', personCount: 2, claimCount: 2 },
      { decade: '1790s', personCount: 2, claimCount: 3 },
      { decade: '1810s', personCount: 1, claimCount: 1 },
      { decade: '1820s', personCount: 3, claimCount: 3 },
      { decade: '1830s', personCount: 5, claimCount: 7 },
      { decade: '1840s', personCount: 8, claimCount: 9 },
      { decade: '1850s', personCount: 7, claimCount: 8 },
      { decade: '1860s', personCount: 26, claimCount: 33 },
      { decade: '1870s', personCount: 34, claimCount: 47 },
      { decade: '1880s', personCount: 17, claimCount: 19 },
      { decade: '1890s', personCount: 13, claimCount: 18 },
      { decade: '1900s', personCount: 18, claimCount: 19 },
      { decade: '1910s', personCount: 19, claimCount: 21 },
      { decade: '1920s', personCount: 23, claimCount: 29 },
      { decade: '1930s', personCount: 10, claimCount: 12 },
      { decade: '1940s', personCount: 28, claimCount: 31 },
      { decade: '1950s', personCount: 29, claimCount: 31 },
      { decade: '1960s', personCount: 75, claimCount: 97 },
      { decade: '1970s', personCount: 32, claimCount: 42 },
      { decade: '1980s', personCount: 40, claimCount: 45 },
      { decade: '1990s', personCount: 33, claimCount: 37 },
      { decade: '2000s', personCount: 37, claimCount: 43 },
      { decade: '2010s', personCount: 25, claimCount: 28 },
      { decade: '2020s', personCount: 16, claimCount: 17 },
    ],
  },
  personDecadeCoverageSourceQuery: `
    with active as (select release_id from bb_public.active_release limit 1),
    persons as (select entity_id from bb_public.release_entities re, active a where re.release_id=a.release_id and re.kind='person'),
    years as (
      select p.entity_id, (substring(cv.object::text from '(1[5-9]\\d{2}|20[0-2]\\d)'))::int as yr
      from persons p
      join bb_canonical.claims c on c.entity_id = p.entity_id
      join bb_canonical.claim_versions cv on cv.id = c.current_version_id
      where cv.object is not null
    )
    select (floor(yr/10)*10)::text || 's' as decade, count(distinct entity_id) as person_count, count(*) as claim_count
    from years where yr is not null group by 1 order by 1;
  `.trim(),
};

/**
 * Attempts a live Postgres query via `pg` + `DATABASE_URL`/`APP_DATABASE_URL` (the same env-var
 * convention as apps/api-public, see apps/api-public/src/http/README.md). Returns `undefined` on
 * any failure — missing driver, missing env var, connection error — so callers can fall back to
 * `DB_SNAPSHOT` instead of crashing this otherwise-offline script.
 *
 * @param {string} sql
 * @returns {Promise<any[] | undefined>}
 */
async function tryLiveQuery(sql) {
  const connectionString = process.env.DATABASE_URL ?? process.env.APP_DATABASE_URL;
  if (!connectionString) {
    console.warn('  (no DATABASE_URL/APP_DATABASE_URL set — using DB_SNAPSHOT instead)');
    return undefined;
  }
  try {
    const { Client } = await import('pg');
    const client = new Client({ connectionString });
    await client.connect();
    try {
      const result = await client.query(sql);
      return result.rows;
    } finally {
      await client.end();
    }
  } catch (error) {
    console.warn(`  (live query failed, using DB_SNAPSHOT instead: ${error.message})`);
    return undefined;
  }
}

/**
 * Section 1: per-entity-kind blank-field completeness audit against `bb_public.release_entities`
 * (same fields/methodology as docs/research/entity-completeness-audit.md §1-2).
 * @returns {Promise<{ generatedAt: string, live: boolean, byKind: typeof DB_SNAPSHOT.entityCompletenessByKind }>}
 */
async function buildEntityCompletenessSection() {
  if (!wantsLiveCompleteness) {
    return { generatedAt: DB_SNAPSHOT.generatedAt, live: false, byKind: DB_SNAPSHOT.entityCompletenessByKind };
  }
  const rows = await tryLiveQuery(DB_SNAPSHOT.entityCompletenessSourceQuery);
  if (!rows) return { generatedAt: DB_SNAPSHOT.generatedAt, live: false, byKind: DB_SNAPSHOT.entityCompletenessByKind };
  const byKind = rows.map((row) => ({
    kind: row.kind,
    n: Number(row.n),
    blankSummary: Number(row.blank_summary),
    blankLocation: Number(row.blank_location),
    blankGeo: Number(row.blank_geo),
    blankClaims: Number(row.blank_claims),
    blankRelated: Number(row.blank_related),
    blankPrimaryImage: Number(row.blank_primary_image),
    blankTaxonomy: Number(row.blank_taxonomy),
    blankHistoricalContext: Number(row.blank_historicalcontext),
    blankEraBuckets: Number(row.blank_erabuckets),
  }));
  return { generatedAt: new Date().toISOString(), live: true, byKind };
}

/**
 * Section 2: figure-category coverage vs a Civil Rights Movement leader reference roster.
 *
 * Reference source: blackpast.org's category pages returned HTTP 403 to automated fetch (tried
 * https://www.blackpast.org/ and https://www.blackpast.org/category/topics-african-american-history/
 * on 2026-07-24 — the site blocks non-browser clients). Substituted a reasonably-fetchable,
 * citable equivalent roster instead: en.wikipedia.org/wiki/List_of_civil_rights_leaders, filtered
 * to figures central to the American Civil Rights Movement (1950s-60s).
 * @returns {Promise<{ generatedAt: string, live: boolean, referenceUrls: string[], roster: typeof DB_SNAPSHOT.civilRightsRosterPresence, presentCount: number, totalCount: number }>}
 */
async function buildFigureCategoryCoverageSection() {
  const referenceUrls = [
    'https://www.blackpast.org/ (403 — blocked automated fetch, cited as attempted primary source)',
    'https://en.wikipedia.org/wiki/List_of_civil_rights_leaders (fetched successfully; used as fallback roster)',
  ];
  let roster = DB_SNAPSHOT.civilRightsRosterPresence;
  let live = false;
  if (wantsLiveCompleteness) {
    const names = roster.map((r) => r.name);
    const valuesSql = names.map((n) => `('${n.replace(/'/g, "''")}')`).join(', ');
    const sql = `
      select r.name, exists (
        select 1 from bb_canonical.entities e
        where e.kind = 'person' and lower(e.display_name) like '%' || lower(r.name) || '%'
      ) as present
      from (values ${valuesSql}) as r(name);
    `;
    const rows = await tryLiveQuery(sql);
    if (rows) {
      roster = rows.map((row) => ({ name: row.name, present: Boolean(row.present) }));
      live = true;
    }
  }
  const presentCount = roster.filter((r) => r.present).length;
  return { generatedAt: live ? new Date().toISOString() : DB_SNAPSHOT.generatedAt, live, referenceUrls, roster, presentCount, totalCount: roster.length };
}

/**
 * Section 3: theme-impact evidence sufficiency — for each question in
 * packages/domain/src/statistics/theme-impact-questions.ts, whether it can be answered today
 * using data outside Chicago/Cook County, and if not, what metro-level data is missing.
 *
 * Parsed from the .ts source as text (this script runs under plain `node`, with no TS loader),
 * matching each `{ id: 'Qn', themeId: ..., priority: ..., ... metricBindings: [...] }` block.
 * The Chicago-only-so-far judgment comes from reading docs/research/holc-chicago-pilot-attribution.md
 * and docs/research/theme-impact-causal-edges-chicago.md, cross-checked against the metric
 * bindings below: metro/county-scoped bindings only have Chicago/Cook-County pilot data ingested
 * today (ingestion for other metros is gated, per theme-impact-questions.ts's file header).
 * @returns {{ generatedAt: string, questionCount: number, questions: Array<Record<string, unknown>> }}
 */
function buildThemeEvidenceSufficiencySection() {
  const source = readFileSync(themeImpactQuestionsPath, 'utf8');
  const blockPattern = /\{\s*id:\s*'(Q\d+)',\s*themeId:\s*'([a-z_]+)',\s*priority:\s*'([A-Za-z0-9]+)',\s*question:\s*'((?:[^'\\]|\\.)*)'/g;

  /** Manual judgment: which questions are metro/county-scoped vs metro-agnostic (per docs above). */
  const METRO_SCOPED_NEEDS = {
    Q2: 'HOLC redlining-grade area/population-share data for metros beyond Chicago (Mapping Inequality has it; not yet ingested for other cities).',
    Q3: 'County-level ACS/NHGIS/HMDA/SCF/SIPP/eviction/HUD-CHAS series for a comparison set of redlined metros beyond Cook County.',
    Q4: 'A second (or third) formerly-graded place with the same county-level indicator series ingested, to write a comparable place narrative.',
    Q6: 'State/national BJS imprisonment and USSC crack/powder sentencing series are national by definition, but the county-level jail (Vera) leg is Cook-County-only today.',
    Q7: 'County-level demographic-change indicators (ACS/NHGIS) plus a project-level urban-renewal source for a metro other than Chicago.',
    Q8: 'State-level BJS imprisonment-rate series for the full 50-state panel (currently only demonstrated for Illinois/Cook County in fixtures).',
    Q9: 'County-level CDC EJI and EPA TRI facility counts for counties outside Cook County.',
    Q11: 'District-level CRDC school civil-rights data and county ACS/NHGIS attainment series for a metro other than Chicago.',
  };
  /** Metro-agnostic by construction: policy-history timelines or the meta gate, not tied to any place. */
  const METRO_AGNOSTIC = new Set(['Q1', 'Q5', 'Q10', 'Q12']);

  const questions = [];
  let match;
  while ((match = blockPattern.exec(source)) !== null) {
    const [, id, themeId, priority, question] = match;
    const blockStart = match.index;
    const nextBlockStart = source.indexOf("{\n    id: '", blockStart + 1);
    const block = source.slice(blockStart, nextBlockStart > 0 ? nextBlockStart : blockStart + 2000);
    const metricBindingCount = (block.match(/kind:\s*'(phase1|proposed|derived)'/g) ?? []).length;
    const metroAgnostic = METRO_AGNOSTIC.has(id);
    questions.push({
      id,
      themeId,
      priority,
      question: question.replace(/\\'/g, "'"),
      metricBindingCount,
      answerableOutsideChicagoToday: metroAgnostic,
      neededMetroData: metroAgnostic ? null : (METRO_SCOPED_NEEDS[id] ?? 'Metro-level indicator data beyond Chicago/Cook County has not been ingested for this question yet.'),
    });
  }

  return { generatedAt: new Date().toISOString(), questionCount: questions.length, questions };
}

/**
 * Section 4: decade coverage of canonical PERSON entities' claims (not just DPLA items/places) —
 * extracts a year from each claim_version's free-text `object` field (same year-regex approach as
 * `yearFrom` above) and buckets into decades, per docs/research methodology.
 * @returns {Promise<{ generatedAt: string, live: boolean, totalPersonEntities: number, personsWithAtLeastOneDatedClaim: number, byDecade: typeof DB_SNAPSHOT.personDecadeCoverage.byDecade, gapDecades: string[] }>}
 */
async function buildPersonDecadeCoverageSection() {
  let data = DB_SNAPSHOT.personDecadeCoverage;
  let live = false;
  if (wantsLiveCompleteness) {
    const rows = await tryLiveQuery(DB_SNAPSHOT.personDecadeCoverageSourceQuery);
    if (rows) {
      data = {
        totalPersonEntities: undefined,
        personsWithAtLeastOneDatedClaim: undefined,
        byDecade: rows.map((row) => ({ decade: row.decade, personCount: Number(row.person_count), claimCount: Number(row.claim_count) })),
      };
      live = true;
    }
  }
  const decadesWithData = new Set(data.byDecade.map((row) => row.decade));
  const minYear = Math.min(...data.byDecade.map((row) => Number.parseInt(row.decade, 10)));
  const maxYear = Math.max(...data.byDecade.map((row) => Number.parseInt(row.decade, 10)));
  const gapDecades = [];
  for (let year = minYear; year <= maxYear; year += 10) {
    const decade = `${year}s`;
    if (!decadesWithData.has(decade)) gapDecades.push(decade);
  }
  return {
    generatedAt: live ? new Date().toISOString() : DB_SNAPSHOT.generatedAt,
    live,
    totalPersonEntities: data.totalPersonEntities,
    personsWithAtLeastOneDatedClaim: data.personsWithAtLeastOneDatedClaim,
    byDecade: data.byDecade,
    gapDecades,
  };
}

/**
 * @param {{
 *   entityCompleteness: Awaited<ReturnType<typeof buildEntityCompletenessSection>>,
 *   figureCategoryCoverage: Awaited<ReturnType<typeof buildFigureCategoryCoverageSection>>,
 *   themeEvidenceSufficiency: ReturnType<typeof buildThemeEvidenceSufficiencySection>,
 *   personDecadeCoverage: Awaited<ReturnType<typeof buildPersonDecadeCoverageSection>>,
 * }} sections
 * @returns {string}
 */
function renderExtendedSectionsMarkdown(sections) {
  const lines = [];

  lines.push('## Per-entity field completeness (bb_public.release_entities)');
  lines.push('');
  lines.push(
    `_${sections.entityCompleteness.live ? 'Live query' : 'Snapshot'} as of ${sections.entityCompleteness.generatedAt}. Methodology: docs/research/entity-completeness-audit.md §1-2._`,
  );
  lines.push('');
  lines.push('| kind | n | blank summary | blank location | blank geo | blank claims | blank related | blank image | blank taxonomy | blank historicalContext | blank eraBuckets |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of sections.entityCompleteness.byKind) {
    lines.push(
      `| ${row.kind} | ${row.n} | ${row.blankSummary} | ${row.blankLocation} | ${row.blankGeo} | ${row.blankClaims} | ${row.blankRelated} | ${row.blankPrimaryImage} | ${row.blankTaxonomy} | ${row.blankHistoricalContext} | ${row.blankEraBuckets} |`,
    );
  }
  lines.push('');

  lines.push('## Figure-category coverage vs reference list');
  lines.push('');
  lines.push(`_${sections.figureCategoryCoverage.live ? 'Live query' : 'Snapshot'} as of ${sections.figureCategoryCoverage.generatedAt}._`);
  lines.push('');
  lines.push('Sources checked:');
  for (const url of sections.figureCategoryCoverage.referenceUrls) lines.push(`- ${url}`);
  lines.push('');
  lines.push(
    `**Civil Rights Movement leaders: ${sections.figureCategoryCoverage.presentCount} of ${sections.figureCategoryCoverage.totalCount} known figures present in bb_canonical (as person entities).**`,
  );
  lines.push('');
  lines.push('| Figure | Present | Note |');
  lines.push('|---|---|---|');
  for (const row of sections.figureCategoryCoverage.roster) {
    lines.push(`| ${row.name} | ${row.present ? 'Yes' : 'No'} | ${row.note ?? ''} |`);
  }
  lines.push('');

  lines.push('## Theme evidence sufficiency (theme-impact-questions.ts)');
  lines.push('');
  lines.push(`_Generated ${sections.themeEvidenceSufficiency.generatedAt}._`);
  lines.push('');
  const sufficientCount = sections.themeEvidenceSufficiency.questions.filter((q) => q.answerableOutsideChicagoToday).length;
  lines.push(
    `**${sufficientCount} of ${sections.themeEvidenceSufficiency.questionCount} theme-impact questions can be answered today using data outside Chicago/Cook County.**`,
  );
  lines.push('');
  lines.push('| ID | Theme | Priority | Answerable beyond Chicago today? | Needed metro-level data if not |');
  lines.push('|---|---|---|---|---|');
  for (const q of sections.themeEvidenceSufficiency.questions) {
    lines.push(
      `| ${q.id} | ${q.themeId} | ${q.priority} | ${q.answerableOutsideChicagoToday ? 'Yes' : 'No'} | ${q.neededMetroData ?? '_n/a_'} |`,
    );
  }
  lines.push('');

  lines.push('## Decade coverage of PERSON entities (not just DPLA items/places)');
  lines.push('');
  lines.push(`_${sections.personDecadeCoverage.live ? 'Live query' : 'Snapshot'} as of ${sections.personDecadeCoverage.generatedAt}._`);
  lines.push('');
  if (sections.personDecadeCoverage.totalPersonEntities !== undefined) {
    lines.push(
      `- Person entities analyzed: **${sections.personDecadeCoverage.totalPersonEntities}**; with at least one dated claim: **${sections.personDecadeCoverage.personsWithAtLeastOneDatedClaim}**`,
    );
    lines.push('');
  }
  lines.push(
    `- Decade gaps in the person-claims story (no dated claim for any person in this decade, within the observed range): **${sections.personDecadeCoverage.gapDecades.length}** — ${sections.personDecadeCoverage.gapDecades.join(', ') || 'none'}`,
  );
  lines.push('');
  lines.push('| Decade | Person count | Claim count |');
  lines.push('|---|---:|---:|');
  for (const row of sections.personDecadeCoverage.byDecade) {
    lines.push(`| ${row.decade} | ${row.personCount} | ${row.claimCount} |`);
  }
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const dplaItems = /** @type {Record<string, unknown>[]} */ (
    loadJsonArray(readFileSync(dplaPath, 'utf8'))
  );
  const corpusEntities = /** @type {Record<string, unknown>[]} */ (
    loadJsonArray(readFileSync(corpusPath, 'utf8'))
  );

  const generatedAt = new Date().toISOString();
  const report = analyzeGap(dplaItems, corpusEntities);
  const markdown = renderMarkdown(report, { dplaPath, corpusPath, generatedAt });

  console.log(
    `Building extended sections${wantsLiveCompleteness ? ' (--completeness: attempting live DB queries)' : ' (offline snapshot; pass --completeness for live DB queries)'}...`,
  );
  const entityCompleteness = await buildEntityCompletenessSection();
  const figureCategoryCoverage = await buildFigureCategoryCoverageSection();
  const themeEvidenceSufficiency = buildThemeEvidenceSufficiencySection();
  const personDecadeCoverage = await buildPersonDecadeCoverageSection();
  const extendedSections = { entityCompleteness, figureCategoryCoverage, themeEvidenceSufficiency, personDecadeCoverage };
  const extendedMarkdown = renderExtendedSectionsMarkdown(extendedSections);
  const fullMarkdown = `${markdown}\n${extendedMarkdown}`;

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, fullMarkdown, 'utf8');

  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(
    jsonPath,
    JSON.stringify({ generatedAt, dplaPath, corpusPath, ...report, ...extendedSections }, null, 2),
    'utf8',
  );

  console.log(`Wrote markdown report: ${outPath}`);
  console.log(`Wrote JSON artifact: ${jsonPath}`);
  console.log(
    `Entity completeness: ${entityCompleteness.byKind.length} kinds. Figure coverage: ${figureCategoryCoverage.presentCount}/${figureCategoryCoverage.totalCount}. Theme sufficiency: ${themeEvidenceSufficiency.questions.filter((q) => q.answerableOutsideChicagoToday).length}/${themeEvidenceSufficiency.questionCount}. Person-decade gaps: ${personDecadeCoverage.gapDecades.length}.`,
  );
  console.log(
    `Underrepresented: ${report.gaps.underrepresentedStates.length} states, ${report.gaps.underrepresentedDecades.length} decades, ${report.gaps.underrepresentedCells.length} cells`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
