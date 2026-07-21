/**
 * Targeted discovery for historic plantations — under-represented in the
 * catalog (only ~4 records displayName-matching "plantation" as of
 * 2026-07-20, against 353 raw candidates found across 14 states' curated
 * Wikipedia categories below).
 *
 * Unlike discover-western-us-history.ts, this does NOT apply the generic
 * Black-history term/relevance filter: a historic Southern plantation's own
 * Wikipedia article intro routinely describes architecture and National
 * Register of Historic Places status without using words like "slavery" or
 * "African American" at all (verified live against Boone Hall, Auldbrass,
 * Hampton Plantation) — the term "plantation" in this antebellum-South
 * context IS the relevance signal itself, the same way lynching-victims'
 * source wikitable didn't need a separate relevance filter. The editorial
 * judge (with full article context, not just the intro) does the real
 * per-record quality/relevance call, same division of labor as the rest of
 * this pipeline.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/discover-plantations.ts --out <candidates.json>
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCommonsMediaClient, type WikidataEntity } from '@repo/domain';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIR = join(PACKAGE_ROOT, 'fixtures/national-catalog');

const WIKIMEDIA_USER_AGENT =
  'BlackStoryDiscovery/1.0 (https://blackstory.app; research-dry-run; mailto:ops@blackstory.app)';
const API = 'https://en.wikipedia.org/w/api.php';

const CATEGORIES = [
  'Plantations in South Carolina',
  'Plantations in Louisiana',
  'Plantations in Georgia (U.S. state)',
  'Plantations in Virginia',
  'Plantations in Alabama',
  'Plantations in Mississippi',
  'Plantations in North Carolina',
  'Plantations in Tennessee',
  'Plantations in Florida',
  'Plantations in Texas',
  'Plantations in Kentucky',
  'Plantations in Maryland',
  'Plantations in Arkansas',
  'Plantations in Delaware',
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
    t.includes(' wikipedia') ||
    /^(portal|template|draft|file|help|wikipedia):/i.test(title)
  );
}

function looksLikeClassDefinition(description: string): boolean {
  const d = description.toLowerCase();
  return (
    d.startsWith('type of ') ||
    d.startsWith('concept of ') ||
    d.startsWith('class of ') ||
    d.startsWith('category of ') ||
    /\bthat (currently|historically)\b/.test(d)
  );
}

/** Drop Wikidata disambiguation / category / metaclass / media pages. */
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
    names.includes('united kingdom')
  );
}

/** A historic estate/site is always kind='place' here — no person-default fallback
 * (see the western-US-history discovery script's inferKind() postmortem: defaulting
 * unmatched titles to 'person' silently mis-tagged non-person subjects and needlessly
 * tripped the living-status privacy gate). Plantations are never people. */
function inferKind(): string {
  return 'place';
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

    for (const title of freshTitles) {
      const resolution = resolvedByTitle.get(normalizeTitleKey(title));
      const wikidataId = resolution?.wikidataId;
      const entity = wikidataId ? entities.get(wikidataId) : undefined;
      const label = entity?.labels?.en?.value ?? resolution?.label ?? title;
      const description = entity?.descriptions?.en?.value;

      if (isNonEntityPage(title, label, description)) {
        skippedNonEntity += 1;
        continue;
      }
      const candidateId = wikidataId ? `plantation_${slugify(label)}_${wikidataId.toLowerCase()}` : `plantation_${slugify(label)}`;
      if (catalogNames.has(label.toLowerCase()) || catalogIds.has(candidateId)) {
        skippedCatalog += 1;
        continue;
      }

      const sourceUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
      candidates.push({
        id: candidateId,
        kind: inferKind(),
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
