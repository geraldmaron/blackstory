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

function main() {
  const dplaItems = /** @type {Record<string, unknown>[]} */ (
    loadJsonArray(readFileSync(dplaPath, 'utf8'))
  );
  const corpusEntities = /** @type {Record<string, unknown>[]} */ (
    loadJsonArray(readFileSync(corpusPath, 'utf8'))
  );

  const generatedAt = new Date().toISOString();
  const report = analyzeGap(dplaItems, corpusEntities);
  const markdown = renderMarkdown(report, { dplaPath, corpusPath, generatedAt });

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, markdown, 'utf8');

  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(
    jsonPath,
    JSON.stringify({ generatedAt, dplaPath, corpusPath, ...report }, null, 2),
    'utf8',
  );

  console.log(`Wrote markdown report: ${outPath}`);
  console.log(`Wrote JSON artifact: ${jsonPath}`);
  console.log(
    `Underrepresented: ${report.gaps.underrepresentedStates.length} states, ${report.gaps.underrepresentedDecades.length} decades, ${report.gaps.underrepresentedCells.length} cells`,
  );
}

main();
