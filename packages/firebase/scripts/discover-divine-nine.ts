/**
 * Targeted discovery for the "Divine Nine" — the nine historically Black
 * fraternities and sororities of the National Pan-Hellenic Council — and
 * their documented founders. Under-represented in the catalog (2026-07-20
 * audit across all 1073 records: 0 "fraternity" hits, 1 "sorority" hit).
 *
 * Unlike a category scrape (see discover-plantations.ts), the nine
 * organizations are a small, closed, well-documented set. Each org's own
 * Wikidata entity carries a P112 ("founder") claim naming its founders
 * directly — that is used instead of crawling each org's "notable members"
 * Wikipedia category, which is dominated by famous alumni already covered
 * elsewhere in the catalog under other campaigns and would mostly produce
 * duplicates rather than new gap-fill signal.
 *
 * Founders are emitted as kind='person' and go through the standard
 * privacy-gated auto-promote-corsair-keeps.ts (not the person-review
 * bypass) since individual living-status has not been verified — some
 * founders of the newest org (Iota Phi Theta, 1963) may still be living.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/discover-divine-nine.ts --out <candidates.json>
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chunkForWikimediaBatch, createCommonsMediaClient, type WikidataEntity } from '@repo/domain';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIR = join(PACKAGE_ROOT, 'fixtures/national-catalog');

const WIKIMEDIA_USER_AGENT =
  'BlackStoryDiscovery/1.0 (https://blackstory.app; research-dry-run; mailto:ops@blackstory.app)';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const FOUNDER_PROPERTY = 'P112';

type OrgSeed = {
  readonly title: string;
  readonly type: 'fraternity' | 'sorority';
  readonly foundingDate: string;
  readonly foundingSchool: string;
};

const ORGANIZATIONS: readonly OrgSeed[] = [
  { title: 'Alpha Phi Alpha', type: 'fraternity', foundingDate: 'December 4, 1906', foundingSchool: 'Cornell University' },
  { title: 'Alpha Kappa Alpha', type: 'sorority', foundingDate: 'January 15, 1908', foundingSchool: 'Howard University' },
  {
    title: 'Kappa Alpha Psi',
    type: 'fraternity',
    foundingDate: 'January 5, 1911',
    foundingSchool: 'Indiana University Bloomington',
  },
  { title: 'Omega Psi Phi', type: 'fraternity', foundingDate: 'November 17, 1911', foundingSchool: 'Howard University' },
  { title: 'Delta Sigma Theta', type: 'sorority', foundingDate: 'January 13, 1913', foundingSchool: 'Howard University' },
  { title: 'Phi Beta Sigma', type: 'fraternity', foundingDate: 'January 9, 1914', foundingSchool: 'Howard University' },
  { title: 'Zeta Phi Beta', type: 'sorority', foundingDate: 'January 16, 1920', foundingSchool: 'Howard University' },
  { title: 'Sigma Gamma Rho', type: 'sorority', foundingDate: 'November 12, 1922', foundingSchool: 'Butler University' },
  {
    title: 'Iota Phi Theta',
    type: 'fraternity',
    foundingDate: 'September 19, 1963',
    foundingSchool: 'Morgan State University',
  },
];

function readArgFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

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

/** Fetch enwiki sitelink titles for Wikidata QIDs (not covered by the shared client). */
async function fetchEnwikiSitelinks(qids: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(qids.filter((q) => /^Q\d+$/i.test(q)))];
  for (const batch of chunkForWikimediaBatch(unique, 50)) {
    const params = new URLSearchParams({
      action: 'wbgetentities',
      ids: batch.join('|'),
      props: 'sitelinks',
      sitefilter: 'enwiki',
      format: 'json',
      origin: '*',
    });
    const response = await fetch(`${WIKIDATA_API}?${params.toString()}`, {
      headers: { 'User-Agent': WIKIMEDIA_USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`wbgetentities sitelinks HTTP ${response.status}`);
    const raw = (await response.json()) as {
      readonly entities?: Readonly<
        Record<string, { readonly sitelinks?: { readonly enwiki?: { readonly title?: string } } }>
      >;
    };
    for (const [id, entity] of Object.entries(raw.entities ?? {})) {
      const title = entity.sitelinks?.enwiki?.title;
      if (title) map.set(id, title.replace(/_/g, ' '));
    }
    await sleep(200);
  }
  return map;
}

function founderQidsFromClaims(entity: WikidataEntity | undefined): readonly string[] {
  const claims = entity?.claims?.[FOUNDER_PROPERTY] ?? [];
  const ids: string[] = [];
  for (const claim of claims) {
    const value = claim.mainsnak.datavalue?.value;
    if (value && typeof value === 'object' && typeof value.id === 'string') {
      ids.push(value.id);
    }
  }
  return ids;
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

async function main(): Promise<void> {
  const outPath = readArgFlag('--out');
  if (!outPath) {
    console.error('Usage: --out <candidates.json>');
    process.exit(2);
  }

  const { names: catalogNames, ids: catalogIds } = loadCatalogNames();
  const client = createCommonsMediaClient({ userAgent: WIKIMEDIA_USER_AGENT, batchDelayMs: 250 });

  const candidates: GapCandidate[] = [];
  let skippedCatalogOrgs = 0;
  let skippedCatalogFounders = 0;
  let skippedNoArticleFounders = 0;
  let founderQidsSeen = 0;

  const orgResolved = await client.resolveEnwikiTitles(ORGANIZATIONS.map((o) => o.title));
  const orgResolvedByTitle = new Map(
    orgResolved.map((r) => [r.title.replace(/_/g, ' ').trim().toLowerCase(), r] as const),
  );
  const orgQids = orgResolved.map((r) => r.wikidataId).filter((q): q is string => q !== undefined);
  const orgEntities = await client.fetchEntitiesById(orgQids);

  const allFounderQids = new Set<string>();

  for (const org of ORGANIZATIONS) {
    const resolution = orgResolvedByTitle.get(org.title.toLowerCase());
    const wikidataId = resolution?.wikidataId;
    const entity = wikidataId ? orgEntities.get(wikidataId) : undefined;
    const label = entity?.labels?.en?.value ?? resolution?.label ?? org.title;
    const description = entity?.descriptions?.en?.value;

    const candidateId = wikidataId ? `divine9_org_${slugify(label)}_${wikidataId.toLowerCase()}` : `divine9_org_${slugify(label)}`;
    const alreadyCataloged = catalogNames.has(label.toLowerCase()) || catalogIds.has(candidateId);
    if (alreadyCataloged) {
      skippedCatalogOrgs += 1;
    } else {
      const sourceUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(org.title.replace(/ /g, '_'))}`;
      candidates.push({
        id: candidateId,
        kind: 'organization',
        displayName: label,
        summary:
          description ??
          `Historically Black ${org.type} founded ${org.foundingDate} at ${org.foundingSchool}, one of the nine National Pan-Hellenic Council ("Divine Nine") organizations.`,
        gapFill: {
          mentionedByEntityIds: [],
          mentionContexts: [
            `Founded ${org.foundingDate} at ${org.foundingSchool}. Member organization of the National Pan-Hellenic Council ("Divine Nine"). ${description ?? ''}`.trim(),
          ],
          candidateSourceHrefs: [sourceUrl],
        },
      });
    }

    if (entity) {
      for (const founderQid of founderQidsFromClaims(entity)) {
        allFounderQids.add(founderQid);
        founderQidsSeen += 1;
      }
    }
  }

  const founderQids = [...allFounderQids];
  const founderEntities = await client.fetchEntitiesById(founderQids);
  const founderSitelinks = await fetchEnwikiSitelinks(founderQids);

  // Re-walk orgs to attribute each founder to its org (for context text) without
  // needing a second index — founder sets are small (a handful per org).
  for (const org of ORGANIZATIONS) {
    const resolution = orgResolvedByTitle.get(org.title.toLowerCase());
    const wikidataId = resolution?.wikidataId;
    const entity = wikidataId ? orgEntities.get(wikidataId) : undefined;
    const orgLabel = entity?.labels?.en?.value ?? resolution?.label ?? org.title;
    if (!entity) continue;

    for (const founderQid of founderQidsFromClaims(entity)) {
      const founderEntity = founderEntities.get(founderQid);
      const enwikiTitle = founderSitelinks.get(founderQid);
      if (!enwikiTitle) {
        skippedNoArticleFounders += 1;
        continue;
      }
      const label = founderEntity?.labels?.en?.value ?? enwikiTitle;
      const description = founderEntity?.descriptions?.en?.value;
      const candidateId = `divine9_founder_${slugify(label)}_${founderQid.toLowerCase()}`;
      if (catalogNames.has(label.toLowerCase()) || catalogIds.has(candidateId)) {
        skippedCatalogFounders += 1;
        continue;
      }
      // A person can co-found more than one org's candidate list only in theory;
      // guard against emitting the same founder twice across orgs.
      if (candidates.some((c) => c.id === candidateId)) continue;

      const sourceUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(enwikiTitle.replace(/ /g, '_'))}`;
      candidates.push({
        id: candidateId,
        kind: 'person',
        displayName: label,
        summary: description ?? `Founding member of ${orgLabel}, founded ${org.foundingDate} at ${org.foundingSchool}.`,
        gapFill: {
          mentionedByEntityIds: [],
          mentionContexts: [
            `Founding member of ${orgLabel}, one of the nine National Pan-Hellenic Council ("Divine Nine") organizations, founded ${org.foundingDate} at ${org.foundingSchool}. ${description ?? ''}`.trim(),
          ],
          candidateSourceHrefs: [sourceUrl],
        },
      });
    }
  }

  writeFileSync(outPath, `${JSON.stringify({ candidates }, null, 2)}\n`);
  console.log(
    JSON.stringify({
      organizationsQueried: ORGANIZATIONS.length,
      founderQidsSeen,
      skippedCatalogOrgs,
      skippedCatalogFounders,
      skippedNoArticleFounders,
      candidatesWritten: candidates.length,
      outPath,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
