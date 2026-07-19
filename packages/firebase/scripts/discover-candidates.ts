/**
 * Live discovery research: find new Black-history candidate entities via the
 * English Wikipedia / Wikidata APIs and stage them as git-durable candidate JSON.
 *
 * Durability contract (matches `enrich-entity-locations.ts`):
 *  - Live Wikipedia/Wikidata are discovery inputs only.
 *  - Accepted candidates are written to
 *    `fixtures/discovery-candidates/<run>.json` (git-durable).
 *  - Raw search + entity JSON is archived under `.cache/discovery/` for replay.
 *  - Never copies Wikipedia search snippets into candidate payload — short
 *    Wikidata `description` labels only.
 *
 * Usage:
 *   node --conditions development --import tsx packages/firebase/scripts/discover-candidates.ts \
 *     [--limit=N] [--query="…"] [--apply]
 */
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
  unlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  coordinateFromWikidataEntity,
  createCommonsMediaClient,
  type WikidataEntity,
} from '@repo/domain';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(PACKAGE_ROOT, '../..');
const ROOT = join(PACKAGE_ROOT, 'fixtures');
const CATALOG_DIR = join(ROOT, 'national-catalog');
const CANDIDATES_DIR = join(ROOT, 'discovery-candidates');
/** Always under repo `.cache/` — independent of process cwd / pnpm filter cwd. */
const CACHE_DIR = join(REPO_ROOT, '.cache/discovery');
const REPORT_PATH = join(REPO_ROOT, '.cache/discovery-report.json');

const WIKIMEDIA_USER_AGENT =
  'BlackStoryDiscovery/1.0 (https://blackstory.app; research-dry-run; mailto:ops@blackstory.app)';

const SEARCH_API = 'https://en.wikipedia.org/w/api.php';

/** Seed topics chosen for known under-coverage in the national catalog. */
const SEED_QUERIES = [
  'African-American neighborhoods',
  'Historically Black Colleges and Universities',
  'Black Wall Street',
  'Greenwood District Tulsa',
  'Rosewood massacre',
  'Black churches United States',
  'Underground Railroad sites',
  'Black owned newspapers',
  'African American museums',
  'Civil Rights Movement leaders',
  'Black cowboys',
  'Black veterans organizations',
  'African American inventors',
  'Black suffrage movement',
  'Black towns Oklahoma',
  'Black business districts',
  'African American cemeteries',
  'Black filmmakers pioneers',
  'Black labor unions',
  'Black women suffragists',
] as const;

type SearchHit = {
  readonly pageid: number;
  readonly title: string;
  readonly snippet: string;
};

type CatalogEntry = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: string;
};

type DiscoveryCandidate = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary: string;
  readonly wikidataId?: string;
  readonly aliases: readonly string[];
  readonly sourceQuery: string;
  readonly canonicalUrl: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly discoveredAt: string;
};

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { 'User-Agent': WIKIMEDIA_USER_AGENT, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Wikimedia HTTP ${response.status} for ${url}`);
  return response.json();
}

async function searchWikipedia(query: string, limit: number): Promise<readonly SearchHit[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: String(limit),
    format: 'json',
    origin: '*',
  });
  const raw = (await getJson(`${SEARCH_API}?${params.toString()}`)) as {
    readonly query?: { readonly search?: readonly SearchHit[] };
  };
  return raw.query?.search ?? [];
}

function loadCatalog(): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  if (!existsSync(CATALOG_DIR)) return out;
  for (const file of readdirSync(CATALOG_DIR).filter((f) => f.endsWith('.json')).sort()) {
    const entries = JSON.parse(readFileSync(join(CATALOG_DIR, file), 'utf8')) as Array<
      Record<string, unknown>
    >;
    for (const raw of entries) {
      out.push({
        id: String(raw.id),
        displayName: String(raw.displayName ?? ''),
        kind: String(raw.kind ?? 'other'),
      });
    }
  }
  return out;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function normalizeTitleKey(title: string): string {
  return title.replace(/_/g, ' ').trim().toLowerCase();
}

/** Drop generic container / aggregation / namespace pages that are not concrete candidates. */
function isGenericContainer(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t.startsWith('list of') ||
    t.startsWith('category:') ||
    t.endsWith(' in the united states') ||
    /^colleges and universities in /.test(t) ||
    t === 'african-american culture' ||
    t.includes(' wikipedia') ||
    /^(portal|template|draft|file|help|wikipedia):/i.test(title) ||
    /\bneighborhoods in\b/.test(t)
  );
}

/** True when the Wikidata description defines a class/concept, not a concrete entity. */
function looksLikeClassDefinition(description: string): boolean {
  const d = description.toLowerCase();
  return (
    d.startsWith('type of ') ||
    d.startsWith('concept of ') ||
    d.startsWith('class of ') ||
    d.startsWith('category of ') ||
    /^(colleges|universities|churches|laws|people|networks|ethnic enclaves|newspapers|business enterprise|criminal organization)\b/.test(
      d,
    ) ||
    /\bthat (currently|historically)\b/.test(d)
  );
}

/** Drop Wikidata disambiguation / category / metaclass / media / demonym pages. */
function isNonEntityPage(
  title: string,
  label: string,
  description: string | undefined,
): boolean {
  const t = title.toLowerCase();
  const l = label.toLowerCase();
  const d = (description ?? '').toLowerCase();
  const names = `${t} ${l}`;
  return (
    !description ||
    `${names} ${d}`.includes('disambiguation') ||
    d.includes('wikimedia list article') ||
    d.includes('wikimedia category') ||
    d.includes('metaclass') ||
    looksLikeClassDefinition(description) ||
    /\b(television series|tv series|film|movie|song|album|video game|podcast)\b/.test(d) ||
    /^(newspaper|organization|timeline|social class|ideology|political concept|films made by)\b/.test(
      d,
    ) ||
    t.startsWith('timeline of ') ||
    l.startsWith('timeline of ') ||
    names.includes('united kingdom') ||
    /\b(african americans|black people|black church|african american newspapers?|african-american newspapers?|african-american business|african american cinema|historically black college)\b/.test(
      names,
    ) ||
    /\b(universal suffrage|women's suffrage|anti-suffragism)\b/.test(names) ||
    /^african americans in /.test(t) ||
    /^african americans in /.test(l)
  );
}

/**
 * Black-history relevance gate. Geo tokens alone are not enough — otherwise every
 * Tulsa/Rosewood page survives. Require a core history term in title or description.
 */
function looksRelevant(title: string, description: string | undefined): boolean {
  const hay = `${title} ${description ?? ''}`.toLowerCase();
  const terms = [
    'african american',
    'african-american',
    'black ',
    'negro',
    'civil rights',
    'race massacre',
    'race riot',
    'underground railroad',
    'jim crow',
    'segregation',
    'suffrag',
    'hbcu',
    'historically black',
    'emancipation',
    'black wall street',
    'greenwood district',
  ];
  return terms.some((term) => hay.includes(term));
}

function inferKind(title: string, description: string | undefined): string {
  const hay = `${title} ${description ?? ''}`.toLowerCase();
  if (/\b(college|university|hbcu|school|academy)\b/.test(hay)) return 'institution';
  if (/\b(museum|library|archive|cemetery|church|mosque|synagogue)\b/.test(hay)) return 'place';
  if (/\b(neighborhood|district|town|settlement|community)\b/.test(hay)) return 'place';
  if (/\b(massacre|riot|movement|boycott|march)\b/.test(hay)) return 'event';
  if (/\b(newspaper|journal|magazine|publisher)\b/.test(hay)) return 'organization';
  if (/\b(union|organization|association|society|league)\b/.test(hay)) return 'organization';
  if (/\b(inventor|filmmaker|activist|suffrag|leader|cowboy|veteran)\b/.test(hay)) return 'person';
  return 'other';
}

function archiveJson(key: string, payload: unknown): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(join(CACHE_DIR, `${key}.json`), `${JSON.stringify(payload, null, 2)}\n`);
}

async function main(): Promise<void> {
  const apply = hasFlag('apply');
  const explicitQuery = arg('query');
  const perQueryLimit = arg('limit') ? Math.max(1, Number(arg('limit'))) : 8;
  const queries = explicitQuery ? [explicitQuery] : [...SEED_QUERIES];

  const catalog = loadCatalog();
  const catalogNames = new Set(catalog.map((c) => c.displayName.toLowerCase()));
  const catalogIds = new Set(catalog.map((c) => c.id));
  const catalogWikidata = new Set(
    catalog
      .map((c) => {
        const match = /^disc_.*_(q\d+)$/i.exec(c.id);
        return match?.[1]?.toUpperCase();
      })
      .filter((id): id is string => id !== undefined),
  );
  // Also index any explicit wikidataId fields if present on catalog rows.
  for (const file of existsSync(CATALOG_DIR)
    ? readdirSync(CATALOG_DIR).filter((f) => f.endsWith('.json'))
    : []) {
    const entries = JSON.parse(readFileSync(join(CATALOG_DIR, file), 'utf8')) as Array<
      Record<string, unknown>
    >;
    for (const raw of entries) {
      if (typeof raw.wikidataId === 'string' && /^Q\d+$/i.test(raw.wikidataId)) {
        catalogWikidata.add(raw.wikidataId.toUpperCase());
      }
    }
  }

  const client = createCommonsMediaClient({
    userAgent: WIKIMEDIA_USER_AGENT,
    batchDelayMs: 250,
  });

  const candidates: DiscoveryCandidate[] = [];
  const seenTitles = new Set<string>();
  const seenQids = new Set<string>();
  const report: Array<Record<string, unknown>> = [];
  let searchHits = 0;
  let skippedDuplicate = 0;
  let skippedFilter = 0;
  let skippedCatalog = 0;

  for (const query of queries) {
    const hits = await searchWikipedia(query, perQueryLimit);
    searchHits += hits.length;

    const titles = hits.map((h) => h.title);
    const resolved = await client.resolveEnwikiTitles(titles);
    const qids = resolved.map((r) => r.wikidataId).filter((q): q is string => q !== undefined);
    // Single entity fetch: labels + descriptions + aliases + claims (coords).
    const entities = qids.length > 0 ? await client.fetchEntitiesById(qids) : new Map();
    archiveJson(`search-${slugify(query)}`, { query, hits });

    const resolvedByTitle = new Map(
      resolved.map((r) => [normalizeTitleKey(r.title), r] as const),
    );

    for (const hit of hits) {
      const titleKey = normalizeTitleKey(hit.title);
      if (seenTitles.has(titleKey)) {
        skippedDuplicate += 1;
        continue;
      }
      seenTitles.add(titleKey);

      const resolution = resolvedByTitle.get(titleKey);
      const wikidataId = resolution?.wikidataId;
      const entity: WikidataEntity | undefined = wikidataId ? entities.get(wikidataId) : undefined;
      const label = entity?.labels?.en?.value ?? resolution?.label ?? hit.title;
      const description = entity?.descriptions?.en?.value;

      if (
        isGenericContainer(hit.title) ||
        isNonEntityPage(hit.title, label, description) ||
        !looksRelevant(`${hit.title} ${label}`, description)
      ) {
        skippedFilter += 1;
        report.push({
          action: 'filtered',
          title: hit.title,
          description: description ?? null,
          query,
        });
        continue;
      }

      if (wikidataId) {
        const qKey = wikidataId.toUpperCase();
        if (seenQids.has(qKey) || catalogWikidata.has(qKey)) {
          skippedCatalog += 1;
          continue;
        }
        seenQids.add(qKey);
      }

      const candidateId = wikidataId
        ? `disc_${slugify(label)}_${wikidataId.toLowerCase()}`
        : `disc_${slugify(label)}`;
      if (catalogNames.has(label.toLowerCase()) || catalogIds.has(candidateId)) {
        skippedCatalog += 1;
        continue;
      }

      const coord =
        wikidataId && entity ? coordinateFromWikidataEntity(entity, wikidataId) : undefined;
      const aliases = entity?.aliases?.en?.map((a) => a.value).filter(Boolean) ?? [];

      const candidate: DiscoveryCandidate = {
        id: candidateId,
        kind: inferKind(label, description),
        displayName: label,
        summary: description ?? '',
        ...(wikidataId !== undefined ? { wikidataId } : {}),
        aliases,
        sourceQuery: query,
        canonicalUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
        ...(coord
          ? { lat: Math.round(coord.lat * 1e5) / 1e5, lng: Math.round(coord.lng * 1e5) / 1e5 }
          : {}),
        discoveredAt: new Date().toISOString(),
      };
      candidates.push(candidate);
      report.push({ action: 'new_candidate', id: candidateId, displayName: label, query });
    }
  }

  const run = new Date().toISOString().replace(/[:.]/g, '-');
  const summary = {
    queriesRun: queries.length,
    searchHits,
    skippedDuplicate,
    skippedFilter,
    skippedCatalog,
    newCandidates: candidates.length,
  };

  if (apply) {
    mkdirSync(CANDIDATES_DIR, { recursive: true });
    // Keep a single latest research slice in fixtures (prior runs live in .cache/).
    for (const prior of readdirSync(CANDIDATES_DIR).filter(
      (f) => f.startsWith('run-') && f.endsWith('.json'),
    )) {
      unlinkSync(join(CANDIDATES_DIR, prior));
    }
    const path = join(CANDIDATES_DIR, `run-${run}.json`);
    writeFileSync(
      path,
      `${JSON.stringify({ generatedAt: new Date().toISOString(), summary, candidates }, null, 2)}\n`,
    );
    console.log(`Wrote ${candidates.length} candidates → ${path}`);
  } else {
    console.log('Dry run (pass --apply to stage candidate fixtures).');
    if (candidates.length > 0) {
      console.log('Sample new candidates:');
      for (const c of candidates.slice(0, 10)) {
        console.log(
          `  - ${c.displayName} (${c.wikidataId ?? 'no QID'})${c.lat !== undefined ? ` @ ${c.lat},${c.lng}` : ''} [${c.kind}]`,
        );
      }
    }
  }

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify({ summary, report }, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report: ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
