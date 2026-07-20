/**
 * Targeted discovery for Black history of the western United States — a
 * region under-represented in the catalog (16.7% of jurisdiction-tagged
 * entities as of 2026-07-20, against 13 of 50 states / ~26% by state count).
 * Unlike the lynching-victims/officeholders lists, there is no single
 * authoritative wikitable for this domain; instead this pulls members of
 * Wikipedia's curated state/topic categories — a more complete source than
 * keyword search for a domain spread across many individual articles.
 *
 * Reuses the exact relevance/non-entity/kind-inference gates proven in
 * discover-candidates.ts (duplicated here rather than imported since those
 * helpers aren't exported) so noisy category members (e.g. "1993 Michael
 * Jackson sexual abuse allegations" surfaced under Category:African-American
 * history of California) get filtered the same way search hits do there.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/discover-western-us-history.ts --out <candidates.json>
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCommonsMediaClient, type WikidataEntity } from '@repo/domain';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(PACKAGE_ROOT, '../..');
const CATALOG_DIR = join(PACKAGE_ROOT, 'fixtures/national-catalog');

const WIKIMEDIA_USER_AGENT =
  'BlackStoryDiscovery/1.0 (https://blackstory.app; research-dry-run; mailto:ops@blackstory.app)';
const API = 'https://en.wikipedia.org/w/api.php';

const CATEGORIES = [
  'Buffalo Soldiers',
  'African-American history of California',
  'African-American history of Oregon',
  'African-American history of Washington (state)',
  'African-American history of Colorado',
  'African-American history of Nevada',
  'African-American history of Arizona',
  'African-American history of New Mexico',
  'African-American history of Utah',
  'African-American history of Montana',
  'African-American history of Kansas',
  'African-American history of Wyoming',
];

type CategoryMember = { readonly title: string; readonly ns: number };

function readArgFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCategoryMembers(category: string): Promise<readonly CategoryMember[]> {
  const members: CategoryMember[] = [];
  let cmcontinue: string | undefined;
  for (;;) {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmlimit: '200',
      format: 'json',
    });
    if (cmcontinue) params.set('cmcontinue', cmcontinue);
    const response = await fetch(`${API}?${params.toString()}`, {
      headers: { 'User-Agent': WIKIMEDIA_USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`categorymembers HTTP ${response.status} for ${category}`);
    const raw = (await response.json()) as {
      readonly query?: { readonly categorymembers?: readonly CategoryMember[] };
      readonly continue?: { readonly cmcontinue?: string };
    };
    members.push(...(raw.query?.categorymembers ?? []));
    cmcontinue = raw.continue?.cmcontinue;
    if (!cmcontinue) break;
    await sleep(200);
  }
  return members;
}

/**
 * Batched intro-extract fetch. MediaWiki's TextExtracts silently caps how many
 * pages in one multi-title query actually get an `extract` field — verified live
 * at exactly 20 regardless of an explicit `exlimit=max`; the rest of the batch
 * comes back with no extract key at all, no error. Batch size here MUST stay at
 * or under that cap or later titles in each batch silently lose their extract.
 * Wikidata's short `description` is too sparse for this relevance check — it says
 * "United States Army Medal of Honor recipient" for BOTH a genuine Buffalo Soldier
 * and the white officer who commanded him. The article's own intro prose reliably
 * says "was a Buffalo Soldier" for the former and never for the latter.
 */
async function fetchIntroExtracts(titles: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const EXTRACT_BATCH_SIZE = 20;
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += EXTRACT_BATCH_SIZE) {
    const batch = titles.slice(i, i + EXTRACT_BATCH_SIZE);
    const params = new URLSearchParams({
      action: 'query',
      prop: 'extracts',
      exintro: '1',
      explaintext: '1',
      titles: batch.join('|'),
      format: 'json',
    });
    const response = await fetch(`${API}?${params.toString()}`, {
      headers: { 'User-Agent': WIKIMEDIA_USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) continue;
    const raw = (await response.json()) as {
      readonly query?: { readonly pages?: Record<string, { readonly title?: string; readonly extract?: string }> };
    };
    for (const page of Object.values(raw.query?.pages ?? {})) {
      if (page.title && page.extract) out.set(normalizeTitleKey(page.title), page.extract);
    }
    await sleep(200);
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

/** Drop generic container / aggregation / namespace pages — not concrete candidates. */
function isGenericContainer(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t.startsWith('list of') ||
    t.startsWith('category:') ||
    t.endsWith(' in the united states') ||
    /^colleges and universities in /.test(t) ||
    t.includes(' wikipedia') ||
    /^(portal|template|draft|file|help|wikipedia):/i.test(title) ||
    /\bneighborhoods in\b/.test(t)
  );
}

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
function isNonEntityPage(title: string, label: string, description: string | undefined): boolean {
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
    /^(newspaper|organization|timeline|social class|ideology|political concept|films made by)\b/.test(d) ||
    t.startsWith('timeline of ') ||
    l.startsWith('timeline of ') ||
    names.includes('united kingdom')
  );
}

/**
 * Black-history relevance gate (same term list as discover-candidates.ts, extended
 * with Buffalo Soldier / regiment terms since category membership here pulls in a
 * commanding officer's own article too — e.g. John J. Pershing and Ranald Mackenzie
 * surfaced under Category:Buffalo Soldiers despite being white generals with no
 * Black-history term anywhere in their own Wikidata description).
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
    'buffalo soldier',
    'enslaved',
    'exoduster',
    'colored',
    '9th cavalry',
    '10th cavalry',
    '24th infantry',
    '25th infantry',
  ];
  return terms.some((term) => hay.includes(term));
}

/**
 * Live incident: defaulting every unmatched title to 'person' silently mis-tagged
 * parks, buildings, legislative acts, and robberies as people (Peck's Pier and
 * Pavilion, the Wham Paymaster Robbery, the Arizona Organic Act, George Washington
 * Carver Homestead Site, all surfaced as kind='person' this run) -- which then
 * needlessly tripped the person-living-status privacy gate for things that were
 * never people at all, requiring manual review to discover they weren't a privacy
 * concern in the first place. Person is now a POSITIVE match (a birth-death year
 * range or explicit biographical language in the description) rather than the
 * fallback; anything else lands in 'other', a neutral bucket the privacy gate
 * doesn't apply to.
 */
function inferKind(title: string, description: string | undefined): string {
  const hay = `${title} ${description ?? ''}`.toLowerCase();
  if (/\b(college|university|hbcu|school|academy)\b/.test(hay)) return 'institution';
  if (
    /\b(museum|library|archive|cemetery|church|mosque|synagogue|fort|camp|park|canyon|hotel|building|pier|pavilion|lodge|homestead|townsite)\b/.test(
      hay,
    )
  )
    return 'place';
  if (/\b(neighborhood|district|town|settlement|community)\b/.test(hay)) return 'place';
  if (/\b(massacre|riot|movement|boycott|march|battle|expedition|incident|robbery|death of|killing of)\b/.test(hay))
    return 'event';
  if (/\b(newspaper|journal|magazine|publisher)\b/.test(hay)) return 'organization';
  if (/\b(union|organization|association|society|league|regiment|cavalry|infantry|club|team)\b/.test(hay))
    return 'organization';
  if (/\b(act|law|amendment|ordinance|constitution)\b/.test(hay)) return 'other';
  if (description && /\(\s*(?:c\.\s*)?\d{3,4}\s*[-–]\s*(?:\d{3,4}|present|\?)?\s*\)/.test(description)) return 'person';
  if (/\b(born|american \w+|writer|activist|politician|athlete|soldier|educator|artist|entrepreneur|pioneer)\b/.test(hay))
    return 'person';
  return 'other';
}

type GapCandidate = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary: string;
  readonly gapFill: {
    readonly mentionedByEntityIds: readonly string[];
    readonly mentionContexts: readonly string[];
    readonly candidateSourceHrefs: readonly string[];
  };
};

function loadCatalogNames(): { names: Set<string>; ids: Set<string> } {
  const names = new Set<string>();
  const ids = new Set<string>();
  if (!existsSync(CATALOG_DIR)) return { names, ids };
  for (const file of readdirSync(CATALOG_DIR).filter((f) => f.endsWith('.json'))) {
    let entries: unknown;
    try {
      entries = JSON.parse(readFileSync(join(CATALOG_DIR, file), 'utf8'));
    } catch {
      continue;
    }
    const list = Array.isArray(entries) ? entries : [entries];
    for (const raw of list) {
      if (raw && typeof raw === 'object' && 'id' in raw) {
        const rec = raw as Record<string, unknown>;
        if (typeof rec.id === 'string') ids.add(rec.id);
        if (typeof rec.displayName === 'string') names.add(rec.displayName.toLowerCase());
      }
    }
  }
  return { names, ids };
}

async function main(): Promise<void> {
  const outPath = readArgFlag('--out');
  if (!outPath) {
    console.error('Usage: --out <candidates.json>');
    process.exit(2);
  }

  const { names: catalogNames, ids: catalogIds } = loadCatalogNames();
  const client = createCommonsMediaClient({ userAgent: WIKIMEDIA_USER_AGENT, batchDelayMs: 250 });

  const seenTitles = new Set<string>();
  const candidates: GapCandidate[] = [];
  let totalMembers = 0;
  let skippedContainer = 0;
  let skippedDuplicate = 0;
  let skippedNonEntity = 0;
  let skippedIrrelevant = 0;
  let skippedCatalog = 0;

  for (const category of CATEGORIES) {
    const members = await fetchCategoryMembers(category);
    totalMembers += members.length;
    console.error(`[${category}] ${members.length} members`);

    const articleMembers = members.filter((m) => m.ns === 0 && !isGenericContainer(m.title));
    skippedContainer += members.length - articleMembers.length;

    const freshTitles = articleMembers
      .map((m) => m.title)
      .filter((title) => {
        const key = normalizeTitleKey(title);
        if (seenTitles.has(key)) {
          skippedDuplicate += 1;
          return false;
        }
        seenTitles.add(key);
        return true;
      });
    if (freshTitles.length === 0) continue;

    const resolved = await client.resolveEnwikiTitles(freshTitles);
    const qids = resolved.map((r) => r.wikidataId).filter((q): q is string => q !== undefined);
    const entities = qids.length > 0 ? await client.fetchEntitiesById(qids) : new Map<string, WikidataEntity>();
    const resolvedByTitle = new Map(resolved.map((r) => [normalizeTitleKey(r.title), r] as const));
    const extracts = await fetchIntroExtracts(freshTitles);

    for (const title of freshTitles) {
      const resolution = resolvedByTitle.get(normalizeTitleKey(title));
      const wikidataId = resolution?.wikidataId;
      const entity = wikidataId ? entities.get(wikidataId) : undefined;
      const label = entity?.labels?.en?.value ?? resolution?.label ?? title;
      const description = entity?.descriptions?.en?.value;
      const extract = extracts.get(normalizeTitleKey(title));

      if (isNonEntityPage(title, label, description)) {
        skippedNonEntity += 1;
        continue;
      }
      if (!looksRelevant(`${title} ${label}`, description) && !looksRelevant(title, extract)) {
        skippedIrrelevant += 1;
        if (process.env.DEBUG_DISCOVERY) console.error(`  [irrelevant] ${title} :: ${description ?? '(no description)'} :: ${(extract ?? '').slice(0, 100)}`);
        continue;
      }
      const candidateId = wikidataId
        ? `west_${slugify(label)}_${wikidataId.toLowerCase()}`
        : `west_${slugify(label)}`;
      if (catalogNames.has(label.toLowerCase()) || catalogIds.has(candidateId)) {
        skippedCatalog += 1;
        continue;
      }

      const sourceUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
      candidates.push({
        id: candidateId,
        kind: inferKind(title, description),
        displayName: label,
        summary: description ?? `Documented under Wikipedia's "${category}" category.`,
        gapFill: {
          mentionedByEntityIds: [],
          mentionContexts: [`Documented under Wikipedia's "${category}" category. ${description ?? ''}`.trim().slice(0, 500)],
          candidateSourceHrefs: [sourceUrl],
        },
      });
    }
    await sleep(300);
  }

  writeFileSync(outPath, `${JSON.stringify({ candidates }, null, 2)}\n`);
  console.log(
    JSON.stringify({
      categoriesQueried: CATEGORIES.length,
      totalMembers,
      skippedContainer,
      skippedDuplicate,
      skippedNonEntity,
      skippedIrrelevant,
      skippedCatalog,
      candidatesWritten: candidates.length,
      outPath,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
