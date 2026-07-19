/**
 * Merge SearXNG authority leads into national-catalog fixture claims.
 * Filters to loc.gov / nps.gov / archives.gov, dedupes URLs, and adds up to
 * three high-confidence `documented_by` claims per entity when leads score strong.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/merge-thin-source-leads.ts \
 *     --in /tmp/thin-source-leads-40.json \
 *     [--dry-run] [--max-per-entity=3]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type CatalogClaim = {
  predicate?: string;
  object?: string;
  confidenceLevel?: string;
  citationSource?: string;
  citationHref?: string;
  citationLabel?: string;
};

type CatalogEntity = {
  id: string;
  kind?: string;
  displayName?: string;
  summary?: string;
  claims?: CatalogClaim[];
};

type Lead = { title: string; url: string; query?: string };

type LeadsReport = {
  entities: {
    id: string;
    title: string;
    leads: Lead[];
  }[];
};

const AUTHORITY_HOSTS = ['loc.gov', 'nps.gov', 'archives.gov'];

const WEAK_PATH_RE =
  /\/(GCutter|fedreg|usrep|calbk|llflg|inside_adams|labs\.loc\.gov|machine-learning|meet-mr-bingle|jim-belushi|vhp-founding-partners)\b/i;

function parseArgs(argv: readonly string[]): {
  inPath: string;
  catalogDir: string;
  dryRun: boolean;
  maxPerEntity: number;
} {
  let inPath = '/tmp/thin-source-leads-40.json';
  let catalogDir = 'packages/firebase/fixtures/national-catalog';
  let dryRun = false;
  let maxPerEntity = 3;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--in') inPath = String(argv[++i] ?? inPath);
    else if (arg === '--catalog-dir') catalogDir = String(argv[++i] ?? catalogDir);
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--max-per-entity') maxPerEntity = Number(argv[++i] ?? maxPerEntity);
  }
  return { inPath, catalogDir, dryRun, maxPerEntity };
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.search = '';
    const path = u.pathname.replace(/\/+$/, '');
    return `${u.hostname.toLowerCase()}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function citationSourceFromUrl(url: string): string {
  if (/archives\.gov/i.test(url)) return 'archives.gov';
  if (/nps\.gov/i.test(url)) return 'nps.gov';
  return 'loc.gov';
}

function authorityLabel(source: string): string {
  if (source === 'archives.gov') return 'National Archives';
  if (source === 'nps.gov') return 'National Park Service';
  return 'Library of Congress';
}

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !['the', 'and', 'city', 'town'].includes(t));
}

function isAuthorityUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return AUTHORITY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function scoreLead(lead: Lead, entity: CatalogEntity): number {
  const url = lead.url;
  const title = lead.title.toLowerCase();
  const tokens = nameTokens(entity.displayName ?? entity.id);
  const tokenHit = tokens.some((t) => title.includes(t) || url.toLowerCase().includes(t));
  let score = 0;

  if (!isAuthorityUrl(url)) return -100;
  if (WEAK_PATH_RE.test(url)) score -= 30;

  if (/nps\.gov\/places\//i.test(url)) score += 18;
  if (/npgallery\.nps\.gov\/NRHP\/GetAsset/i.test(url)) score += 16;
  if (/nps\.gov\/subjects\/nationalregister/i.test(url)) score += 12;
  if (/www\.loc\.gov\/(item|exhibits|collections)\//i.test(url)) score += 14;
  if (/hdl\.loc\.gov\/loc\./i.test(url)) score += 10;
  if (/archives\.gov/i.test(url)) score += 12;
  if (/\.pdf$/i.test(url) && !/NRHP|nomination|theme-study|weekly-list/i.test(url)) score -= 8;

  if (tokenHit) score += 15;
  else score -= 12;

  if (/african.?american|black history|freedom colony|historic places|national register/i.test(title)) {
    score += 6;
  }

  return score;
}

function buildClaim(lead: Lead, entity: CatalogEntity): CatalogClaim {
  const source = citationSourceFromUrl(lead.url);
  const labelPrefix = authorityLabel(source);
  const name = entity.displayName ?? entity.id;
  const object =
    entity.kind === 'person'
      ? `${labelPrefix} holds archival materials documenting ${name}, corroborating biographical and career records cited in this catalog entry`
      : `${labelPrefix} documents ${name} in federal historic-place and archival records, providing independent authority corroboration for this settlement's documented history`;
  return {
    predicate: 'documented_by',
    object,
    confidenceLevel: 'high',
    citationSource: source,
    citationHref: lead.url,
    citationLabel: `${labelPrefix}: ${lead.title.replace(/\s+/g, ' ').trim().slice(0, 120)}`,
  };
}

function loadCatalog(catalogDir: string): Map<string, { file: string; entity: CatalogEntity; index: number }> {
  const map = new Map<string, { file: string; entity: CatalogEntity; index: number }>();
  for (const name of readdirSync(catalogDir)) {
    if (!name.endsWith('.json') || name.startsWith('_')) continue;
    const file = join(catalogDir, name);
    const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    const items = Array.isArray(raw) ? raw : (raw as { entities?: CatalogEntity[] }).entities;
    if (!Array.isArray(items)) continue;
    items.forEach((entity, index) => {
      if (entity?.id) map.set(entity.id, { file, entity, index });
    });
  }
  return map;
}

function existingUrls(entity: CatalogEntity): Set<string> {
  const urls = new Set<string>();
  for (const claim of entity.claims ?? []) {
    if (claim.citationHref) urls.add(normalizeUrl(claim.citationHref));
  }
  return urls;
}

function main(): void {
  const { inPath, catalogDir, dryRun, maxPerEntity } = parseArgs(process.argv.slice(2));
  const report = JSON.parse(readFileSync(inPath, 'utf8')) as LeadsReport;
  const catalog = loadCatalog(catalogDir);
  const touchedFiles = new Map<string, CatalogEntity[]>();
  const stats = {
    entitiesRequested: report.entities.length,
    entitiesFound: 0,
    entitiesEnriched: 0,
    claimsAdded: 0,
    skippedNoStrong: 0,
    skippedMissing: 0,
  };

  for (const row of report.entities) {
    const hit = catalog.get(row.id);
    if (!hit) {
      stats.skippedMissing += 1;
      continue;
    }
    stats.entitiesFound += 1;
    const entity = hit.entity;
    const known = existingUrls(entity);
    const ranked = row.leads
      .filter((lead) => isAuthorityUrl(lead.url))
      .filter((lead) => !known.has(normalizeUrl(lead.url)))
      .map((lead) => ({ lead, score: scoreLead(lead, entity) }))
      .filter(({ score }) => score >= 8)
      .sort((a, b) => b.score - a.score);

    const picks = ranked.slice(0, maxPerEntity).map(({ lead }) => buildClaim(lead, entity));
    if (picks.length === 0) {
      stats.skippedNoStrong += 1;
      continue;
    }

    entity.claims = [...(entity.claims ?? []), ...picks];
    stats.entitiesEnriched += 1;
    stats.claimsAdded += picks.length;

    if (!touchedFiles.has(hit.file)) {
      const raw = JSON.parse(readFileSync(hit.file, 'utf8')) as CatalogEntity[];
      touchedFiles.set(hit.file, raw);
    }
    const fileItems = touchedFiles.get(hit.file)!;
    fileItems[hit.index] = entity;
  }

  if (!dryRun) {
    for (const [file, items] of touchedFiles) {
      writeFileSync(file, `${JSON.stringify(items, null, 2)}\n`);
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        inPath,
        filesUpdated: touchedFiles.size,
        ...stats,
      },
      null,
      2,
    ),
  );
}

main();
