/**
 * Convert the BlackStory curated national seed (verified starter records,
 * `fixtures/seed-programs/blackstory-starter-2026-07/`) into release-ready
 * national-catalog fixture entries, applying the source program's methodology
 * gates before anything reaches the publish lane:
 *
 *  1. Catalog dedupe — records whose normalized name matches an existing
 *     national-catalog entry are skipped (they become enrichment targets, not
 *     duplicates).
 *  2. Geo review — every coordinate is checked against the Census geocoder's
 *     county layer; the record's stated county/parish must contain the point.
 *     Failures are held back to the research lane, never published.
 *  3. Precision policy — Tier 2 archive research points ("verify present-day
 *     parcel before public exact pin") publish at community precision with
 *     coordinates rounded to ~1 km; only source-verified public-site points
 *     keep exact coordinates.
 *
 * Outputs (no Firestore writes — publish stays with publish-national-catalog.ts):
 *   packages/firebase/fixtures/national-catalog/starter-seed-2026-07.json
 *   .cache/starter-seed/report.json          (published / dupes / held, with reasons)
 *   .cache/starter-seed/held-leads.csv       (bulk-import CSV for held records)
 *
 * Usage:
 *   node --conditions development --import tsx packages/firebase/scripts/import-starter-seed.ts
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type StarterRecord = {
  readonly record_id: string;
  readonly canonical_name: string;
  readonly record_type: 'place' | 'organization' | 'event' | 'person';
  readonly subtype: string;
  readonly summary_claim: string;
  readonly start_year: number | null;
  readonly end_year: number | null;
  readonly city_or_locality: string;
  readonly county: string;
  readonly state: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly geo_precision: string;
  readonly coordinate_source: string;
  readonly public_location_policy: string;
  readonly primary_source_name: string;
  readonly primary_source_url: string;
  readonly source_tier: string;
  readonly rights_status: string;
  readonly verification_status: string;
  readonly publication_status: string;
  readonly notes: string;
};

type CatalogClaim = {
  readonly predicate: string;
  readonly object: string;
  readonly confidenceLevel: 'high' | 'medium' | 'low';
  readonly citationSource: string;
  readonly citationHref: string;
  readonly citationLabel: string;
};

type CatalogEntry = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary: string;
  readonly eraBuckets?: readonly string[];
  readonly topicTags: readonly string[];
  readonly topicIds: readonly string[];
  readonly mentionedEntityIds: readonly string[];
  readonly keywords: readonly string[];
  readonly jurisdictionLabel: string;
  readonly locationPrecision: string;
  readonly locationLabel: string;
  readonly lat: number;
  readonly lng: number;
  readonly claims: readonly CatalogClaim[];
  readonly historicalContext: string;
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../../..');
const seedPath = join(
  repoRoot,
  'packages/firebase/fixtures/seed-programs/blackstory-starter-2026-07/blackstory_verified_starter_records.jsonl',
);
const catalogDir = join(repoRoot, 'packages/firebase/fixtures/national-catalog');
const outFixturePath = join(catalogDir, 'starter-seed-2026-07.json');
const cacheDir = join(repoRoot, '.cache/starter-seed');

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AR: 'Arkansas', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', MD: 'Maryland', MO: 'Missouri',
  MS: 'Mississippi', NC: 'North Carolina', OK: 'Oklahoma', SC: 'South Carolina',
  TN: 'Tennessee', TX: 'Texas', VA: 'Virginia', WV: 'West Virginia',
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function slugId(name: string): string {
  const slug = normalizeName(name).replace(/\s/gu, '_').slice(0, 48);
  return `ent_${slug}_001`;
}

function loadCatalogNameIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const file of readdirSync(catalogDir)) {
    if (!file.endsWith('.json') || file === 'starter-seed-2026-07.json') continue;
    const parsed = JSON.parse(readFileSync(join(catalogDir, file), 'utf8')) as Array<{
      id: string;
      displayName: string;
      keywords?: string[];
    }>;
    if (!Array.isArray(parsed)) continue;
    for (const entry of parsed) {
      if (!entry?.displayName) continue;
      index.set(normalizeName(entry.displayName), entry.id);
      // "Frederick Douglass (U.S. Marshal…)" must still match "Frederick Douglass".
      const withoutParenthetical = entry.displayName.replace(/\s*\(.*\)\s*$/u, '');
      if (withoutParenthetical !== entry.displayName) {
        index.set(normalizeName(withoutParenthetical), entry.id);
      }
    }
  }
  return index;
}

/** Census geocoder county containment: the methodology's automated geo review. */
async function lookupCounty(
  lat: number,
  lng: number,
): Promise<{ county: string; state: string } | null> {
  const url =
    'https://geocoding.geo.census.gov/geocoder/geographies/coordinates' +
    `?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const json = (await response.json()) as {
    result?: { geographies?: { Counties?: Array<{ NAME?: string; STUSAB?: string; STATE?: string }> } };
  };
  const county = json.result?.geographies?.Counties?.[0];
  if (!county?.NAME) return null;
  return { county: county.NAME, state: county.STUSAB ?? county.STATE ?? '' };
}

function countyMatches(stated: string, geocoded: string): boolean {
  const clean = (value: string): string =>
    normalizeName(value).replace(/\b(county|parish|city)\b/gu, '').trim();
  return clean(stated) === clean(geocoded) || normalizeName(stated) === normalizeName(geocoded);
}

type Category =
  | 'rosenwald'
  | 'school-site'
  | 'plantation'
  | 'hbcu'
  | 'event'
  | 'person';

function categorize(record: StarterRecord): Category {
  const subtype = record.subtype.toLowerCase();
  if (record.record_type === 'person') return 'person';
  if (record.record_type === 'event') return 'event';
  if (subtype.includes('hbcu')) return 'hbcu';
  if (subtype.includes('rosenwald')) return 'rosenwald';
  if (subtype.includes('plantation')) return 'plantation';
  return 'school-site';
}

const TOPICS: Record<Category, string[]> = {
  rosenwald: ['education', 'segregation', 'philanthropy'],
  'school-site': ['education', 'civil-rights'],
  plantation: ['enslavement', 'history', 'preservation'],
  hbcu: ['hbcu', 'higher-education', 'education'],
  event: ['civil-rights'],
  person: ['civil-rights', 'history'],
};

const CONTEXT: Record<Category, string> = {
  rosenwald:
    'This school belongs to the network of nearly 5,000 Rosenwald Fund schools that Black ' +
    'communities across the segregated South built in partnership with the fund between 1912 ' +
    'and 1937 — raising their own money, land, and labor because public school systems refused ' +
    'to serve Black children equally. The buildings that survive anchor that self-taxation and ' +
    'community-institution story to specific ground.',
  'school-site':
    'Black school sites document how education operated as both the target of segregation and ' +
    'the engine of resistance to it: communities built and defended these schools when public ' +
    'systems excluded their children, and many became organizing grounds for the legal fight ' +
    'that ended de jure school segregation.',
  plantation:
    'Preserved plantation sites hold the documented record of enslaved people’s lives, labor, ' +
    'and communities. Interpreting them as historic places — rather than romanticized estates — ' +
    'keeps the history of enslavement tied to specific ground, named people, and the ' +
    'institutions descendants built afterward.',
  hbcu:
    'Historically Black colleges and universities were founded when higher education excluded ' +
    'Black students; they trained the teachers, clergy, professionals, and organizers who built ' +
    'Black institutional life under segregation and led the civil-rights movement.',
  event:
    'This event is part of the documented struggle over segregation and equal citizenship; its ' +
    'sites and participants connect local organizing to the national legal and political ' +
    'changes that followed.',
  person:
    'An individual whose documented life connects the histories of enslavement, emancipation, ' +
    'education, and civil rights preserved at public historic sites.',
};

function eraBuckets(record: StarterRecord): string[] | undefined {
  const start = record.start_year ?? undefined;
  const end = record.end_year ?? record.start_year ?? undefined;
  if (start === undefined || end === undefined) return undefined;
  const buckets: string[] = [];
  for (let decade = Math.floor(start / 10) * 10; decade <= end; decade += 10) {
    buckets.push(`${decade}s`);
  }
  return buckets;
}

function isExactPublicSite(record: StarterRecord): boolean {
  return (
    record.geo_precision.startsWith('exact') &&
    (record.public_location_policy.includes('public') ||
      record.public_location_policy.includes('campus'))
  );
}

function buildEntry(record: StarterRecord, category: Category): CatalogEntry {
  const stateName = STATE_NAMES[record.state] ?? record.state;
  const locality = record.city_or_locality || record.county;
  const jurisdictionLabel = `${locality}, ${stateName}`;
  const exact = isExactPublicSite(record);
  // Non-exact research points publish at ~1 km until a parcel-level geo review lands.
  const lat = exact ? record.latitude : Math.round(record.latitude * 100) / 100;
  const lng = exact ? record.longitude : Math.round(record.longitude * 100) / 100;
  const locationPrecision = exact
    ? category === 'hbcu'
      ? 'campus'
      : 'site'
    : 'community';
  const locationLabel = exact
    ? `${record.canonical_name}, ${locality}, ${record.state}`
    : `${record.county}, ${stateName} (community-level; exact site pending geo review)`;
  const tier1 = record.source_tier.startsWith('Tier 1');
  const claims: CatalogClaim[] = [
    {
      predicate: 'documented_site',
      object: record.summary_claim,
      confidenceLevel: tier1 ? 'high' : 'medium',
      citationSource: new URL(record.primary_source_url).hostname.replace(/^www\./u, ''),
      citationHref: record.primary_source_url,
      citationLabel: record.primary_source_name,
    },
  ];
  if (record.start_year) {
    claims.push({
      predicate: record.record_type === 'event' ? 'occurred_in' : 'active_years',
      object:
        record.record_type === 'event'
          ? `${record.start_year}${record.end_year && record.end_year !== record.start_year ? `–${record.end_year}` : ''}`
          : `documented in source records for ${record.start_year}–${record.end_year ?? record.start_year}`,
      confidenceLevel: tier1 ? 'high' : 'medium',
      citationSource: new URL(record.primary_source_url).hostname.replace(/^www\./u, ''),
      citationHref: record.primary_source_url,
      citationLabel: record.primary_source_name,
    });
  }
  const kind =
    record.record_type === 'organization'
      ? 'school'
      : category === 'rosenwald' || category === 'school-site'
        ? 'school'
        : record.record_type;
  const summaryParts = [record.summary_claim];
  const localityPhrase = record.city_or_locality
    ? `${record.city_or_locality}, ${record.county}, ${stateName}`
    : `${record.county}, ${stateName}`;
  if (record.record_type === 'person') {
    if (record.start_year || record.end_year) {
      summaryParts.push(
        `Documented life dates: ${record.start_year ?? 'unknown'}–${record.end_year ?? 'unknown'}.`,
      );
    }
    summaryParts.push(`The associated public historic site is in ${localityPhrase}.`);
  } else if (record.record_type === 'event') {
    summaryParts.push(`The event took place in ${localityPhrase}.`);
  } else {
    summaryParts.push(`The site is in ${localityPhrase}.`);
  }
  summaryParts.push(`Documented by ${record.primary_source_name} (${record.source_tier}).`);
  if (record.notes) summaryParts.push(record.notes);
  // Schema window is 120–400 chars: drop trailing optional sentences until it fits.
  while (summaryParts.length > 2 && summaryParts.join(' ').length > 400) {
    summaryParts.pop();
  }
  const era = eraBuckets(record);
  return {
    id: slugId(record.canonical_name),
    kind,
    displayName: record.canonical_name,
    summary: summaryParts.join(' '),
    ...(era ? { eraBuckets: era } : {}),
    topicTags: TOPICS[category],
    topicIds: TOPICS[category],
    mentionedEntityIds: [],
    keywords: [record.subtype, record.county, stateName].filter(Boolean),
    jurisdictionLabel,
    locationPrecision,
    locationLabel,
    lat,
    lng,
    claims,
    historicalContext: CONTEXT[category],
  };
}

function csvEscape(value: string): string {
  return /[",\n]/u.test(value) ? `"${value.replace(/"/gu, '""')}"` : value;
}

async function main(): Promise<void> {
  const records: StarterRecord[] = readFileSync(seedPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as StarterRecord);
  const catalogIndex = loadCatalogNameIndex();
  mkdirSync(cacheDir, { recursive: true });

  const published: CatalogEntry[] = [];
  const duplicates: Array<{ record_id: string; name: string; existingEntityId: string }> = [];
  const held: Array<{ record: StarterRecord; reason: string }> = [];

  for (const record of records) {
    const existing = catalogIndex.get(normalizeName(record.canonical_name));
    if (existing) {
      duplicates.push({
        record_id: record.record_id,
        name: record.canonical_name,
        existingEntityId: existing,
      });
      continue;
    }
    // Geo review (methodology gate): stated county must contain the coordinate.
    const geocoded = await lookupCounty(record.latitude, record.longitude);
    if (!geocoded) {
      held.push({ record, reason: 'geo review unavailable (geocoder returned no county)' });
      continue;
    }
    if (!countyMatches(record.county, geocoded.county)) {
      held.push({
        record,
        reason: `geo review failed: stated "${record.county}" but coordinate resolves to "${geocoded.county}"`,
      });
      continue;
    }
    published.push(buildEntry(record, categorize(record)));
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  writeFileSync(outFixturePath, `${JSON.stringify(published, null, 2)}\n`);

  const heldHeader = 'title,description,url,sourceUrls,location,era';
  const heldRows = held.map(({ record, reason }) =>
    [
      csvEscape(record.canonical_name),
      csvEscape(
        `${record.summary_claim} [held from starter seed: ${reason}] ` +
          `[verification: ${record.verification_status}] [rights: ${record.rights_status}] ` +
          `[coords: ${record.latitude},${record.longitude} (${record.geo_precision})]`,
      ),
      csvEscape(record.primary_source_url),
      csvEscape(record.primary_source_url),
      csvEscape(`${record.city_or_locality || record.county}, ${record.state}`),
      record.start_year ? `${Math.floor(record.start_year / 10) * 10}s` : '',
    ].join(','),
  );
  writeFileSync(join(cacheDir, 'held-leads.csv'), [heldHeader, ...heldRows].join('\n') + '\n');
  writeFileSync(
    join(cacheDir, 'report.json'),
    `${JSON.stringify(
      {
        total: records.length,
        published: published.map((entry) => ({ id: entry.id, name: entry.displayName })),
        duplicatesAsEnrichmentTargets: duplicates,
        held: held.map(({ record, reason }) => ({ record_id: record.record_id, reason })),
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    JSON.stringify(
      {
        total: records.length,
        published: published.length,
        duplicates: duplicates.length,
        held: held.length,
        fixture: outFixturePath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
