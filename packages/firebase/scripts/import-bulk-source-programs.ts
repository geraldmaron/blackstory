/**
 * Deterministic pre-seed import of bulk source programs from the BlackStory source
 * program workbook (`fixtures/seed-programs/blackstory-starter-2026-07/`) into
 * git-durable discovery-candidate fixtures. No LLM involvement: every field is a
 * mechanical projection of the upstream structured data.
 *
 * Lanes (select with --lane=):
 *  - `greenbook`  NYPL Schomburg Center "Negro Motorist Green Book" structured map
 *    data (public domain), 1947 + 1956 editions, fetched from the
 *    NYPL-publicdomain/greenbooks GitHub repository pinned to a specific commit.
 *  - `dc-sites`   "Black History Sites: Washington" (DC Office of Planning /
 *    Historic Preservation Office, CC BY 4.0), fetched from the backing ArcGIS
 *    FeatureServer referenced by the data.gov catalog entry.
 *
 * Durability contract (matches `discover-candidates.ts`):
 *  - Live network sources are discovery inputs only.
 *  - Normalized candidates are written to
 *    `fixtures/discovery-candidates/bulk-<lane>-<date>.json` (git-durable).
 *  - Raw upstream payloads are archived under `.cache/bulk-sources/<lane>/` for
 *    replay, with sha256 content hashes recorded in the fixture metadata.
 *
 * RIGHTS / PUBLICATION GATE (workbook methodology rules 1, 5, 11):
 *  Every record produced here is a candidate attestation — research lane only.
 *  Green Book rows carry OCR-era names/addresses and geocode-era coordinates;
 *  historical tourist-home addresses can be present-day residences. Nothing in
 *  these fixtures may reach a public projection without source verification,
 *  identity resolution, geo review, rights review, and privacy review.
 *
 * Usage (from repo root):
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/import-bulk-source-programs.ts --lane=greenbook
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/import-bulk-source-programs.ts --lane=dc-sites
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(PACKAGE_ROOT, '../..');
const CANDIDATES_DIR = join(PACKAGE_ROOT, 'fixtures/discovery-candidates');
const CACHE_DIR = join(REPO_ROOT, '.cache/bulk-sources');

const USER_AGENT =
  'BlackStoryBulkImport/1.0 (https://blackstory.app; candidate-lane import; mailto:ops@blackstory.app)';

/**
 * NYPL-publicdomain/greenbooks pinned commit so re-runs fetch byte-identical
 * inputs (master as of 2026-07-19). Discovered via
 * https://api.github.com/repos/NYPL-publicdomain/greenbooks/git/trees/master?recursive=1
 */
const GREENBOOKS_COMMIT = '45328936f4984830f6916922238ed5e8c4e024b6';
const GREENBOOKS_RAW = `https://raw.githubusercontent.com/NYPL-publicdomain/greenbooks/${GREENBOOKS_COMMIT}`;
const GREENBOOK_1947_PATH = 'geojson/1947.geojson';
const GREENBOOK_1956_PATH = 'web/public/data/greenbook_1956.json';

/**
 * "Black History Sites: Washington" backing feature layer. The data.gov entry
 * (https://catalog.data.gov/dataset/black-history-sites-washington) resolves to
 * the DC Historic Preservation Office StoryMap, whose operational layer is this
 * hosted FeatureServer ("Black History Sites - Points of Interest").
 */
const DC_SITES_FEATURESERVER =
  'https://services.arcgis.com/neT9SoYxizqTHZPH/arcgis/rest/services/AAHT_Source_Data/FeatureServer/0';
const DC_SITES_CATALOG_URL = 'https://catalog.data.gov/dataset/black-history-sites-washington';

const RESEARCH_LANE_NOTE =
  'research-lane-only: candidate attestation per workbook methodology; ' +
  'never publishable without source, identity, geo, rights, and privacy review';

type Lane = 'greenbook' | 'dc-sites';

interface CandidateProvenance {
  readonly sourceId: string;
  readonly sourceItemId: string;
  readonly sourceUrl: string;
  readonly capturedAt: string;
  readonly editionYear?: number;
  readonly historicAddress?: string;
  readonly sourceCity?: string;
  readonly sourceState?: string;
  readonly sourceCategory?: string;
  readonly geoPrecision?: string;
  readonly geocodedConfidence?: number;
  readonly rights: string;
  readonly attribution?: string;
}

interface BulkCandidate {
  readonly id: string;
  readonly kind: 'place';
  readonly displayName: string;
  readonly summary: string;
  readonly aliases: readonly string[];
  readonly canonicalUrl: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly discoveredAt: string;
  readonly researchLaneOnly: true;
  readonly provenance: CandidateProvenance;
}

interface SourceCapture {
  readonly url: string;
  readonly cachedAs: string;
  readonly contentSha256: string;
  readonly bytes: number;
}

interface DroppedRow {
  readonly sourceItemId: string;
  readonly reason: string;
}

interface FixtureMetadata {
  readonly sourceProgramId: string;
  readonly sourceProgramName: string;
  readonly custodian: string;
  readonly license: string;
  readonly attribution?: string;
  readonly canonicalUrl: string;
  readonly retrievedAt: string;
  readonly count: number;
  readonly droppedCount: number;
  readonly sourceCaptures: readonly SourceCapture[];
  readonly methodologyNotes: readonly string[];
}

interface BulkFixture {
  readonly generatedAt: string;
  readonly metadata: FixtureMetadata;
  readonly summary: {
    readonly rowsFetched: number;
    readonly newCandidates: number;
    readonly skippedUnusable: number;
  };
  readonly dropped: readonly DroppedRow[];
  readonly candidates: readonly BulkCandidate[];
}

interface LaneResult {
  readonly metadata: Omit<FixtureMetadata, 'retrievedAt' | 'count' | 'droppedCount'>;
  readonly rowsFetched: number;
  readonly dropped: readonly DroppedRow[];
  readonly candidates: readonly BulkCandidate[];
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function fetchRaw(
  url: string,
  lane: Lane,
  cacheName: string,
): Promise<{
  readonly text: string;
  readonly capture: SourceCapture;
}> {
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) {
    throw new Error(`fetch failed ${response.status} ${response.statusText}: ${url}`);
  }
  const text = await response.text();
  const cacheLaneDir = join(CACHE_DIR, lane);
  mkdirSync(cacheLaneDir, { recursive: true });
  const cachedAs = join(cacheLaneDir, cacheName);
  writeFileSync(cachedAs, text);
  return {
    text,
    capture: {
      url,
      cachedAs: cachedAs.slice(REPO_ROOT.length + 1),
      contentSha256: createHash('sha256').update(text).digest('hex'),
      bytes: Buffer.byteLength(text),
    },
  };
}

/** Collapse whitespace and strip stray leading/trailing punctuation from OCR text. */
function cleanOcrText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;.:'"“”‘’|—–-]+/, '')
    .replace(/[\s,;:'"“”‘’|—–-]+$/, '')
    .trim();
}

/** Deterministic title case for all-caps OCR locality strings ("EAST ST. LOUIS"). */
function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s\-./'])([a-z])/g, (match) => match.toUpperCase());
}

function roundCoord(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

// --- Lane: greenbook -------------------------------------------------------

interface Greenbook1947Feature {
  readonly geometry?: {
    readonly coordinates?: readonly [number, number];
    readonly interpolated?: boolean;
    readonly omitted?: boolean;
  };
  readonly properties: {
    readonly name?: string;
    readonly address?: string;
    readonly city?: string;
    readonly state?: string;
    readonly category?: string;
    readonly capture_uuid?: string;
    readonly dc_url?: string;
    readonly page?: number;
    readonly geocoded_address?: string;
    readonly geocoded_confidence?: number;
  };
}

interface Greenbook1947File {
  readonly type: string;
  readonly features: readonly Greenbook1947Feature[];
}

/** rows: [name, address, type, year, [lat, lng]] */
type Greenbook1956Row = readonly [string, string, string, string, readonly [number, number] | null];

interface Greenbook1956File {
  readonly rows: readonly Greenbook1956Row[];
  readonly totalrows: number;
  readonly cols: readonly string[];
}

function greenbookGeoPrecision(flags: {
  readonly interpolated?: boolean;
  readonly omitted?: boolean;
  readonly confidence?: number;
}): string {
  const qualifiers: string[] = [];
  if (flags.interpolated) qualifiers.push('interpolated along the street segment');
  if (flags.omitted) qualifiers.push('omitted from the NYPL map UI as unreliable');
  if (flags.confidence !== undefined && flags.confidence < 0.7) {
    qualifiers.push(`low geocoder confidence ${flags.confidence.toFixed(2)}`);
  }
  const base =
    'OCR/geocode-era coordinates from NYPL structured map data; candidate-only, not publishable without geo review';
  return qualifiers.length > 0 ? `${base} (${qualifiers.join('; ')})` : base;
}

/** Parse "420 Butler Street, Anderson, SC 29624" into city/state (geocode-era format). */
function parseModernAddress(address: string): {
  readonly city?: string;
  readonly state?: string;
} {
  const match = /,\s*([^,]+),\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$/.exec(address);
  const city = match?.[1]?.trim();
  const state = match?.[2];
  return {
    ...(city !== undefined && city.length > 0 ? { city } : {}),
    ...(state !== undefined ? { state } : {}),
  };
}

async function runGreenbookLane(now: string): Promise<LaneResult> {
  const rights =
    'Public domain in the U.S. per NYPL; digitized editions and repository data published for reuse';
  const [file1947, file1956] = await Promise.all([
    fetchRaw(`${GREENBOOKS_RAW}/${GREENBOOK_1947_PATH}`, 'greenbook', '1947.geojson'),
    fetchRaw(`${GREENBOOKS_RAW}/${GREENBOOK_1956_PATH}`, 'greenbook', 'greenbook_1956.json'),
  ]);
  const geo1947 = JSON.parse(file1947.text) as Greenbook1947File;
  const data1956 = JSON.parse(file1956.text) as Greenbook1956File;
  if (geo1947.type !== 'FeatureCollection' || !Array.isArray(geo1947.features)) {
    throw new Error('1947 payload is not a GeoJSON FeatureCollection');
  }
  if (!Array.isArray(data1956.rows)) {
    throw new Error('1956 payload has no rows array');
  }

  const candidates: BulkCandidate[] = [];
  const dropped: DroppedRow[] = [];

  geo1947.features.forEach((feature, index) => {
    const itemId = `1947-${String(index).padStart(4, '0')}`;
    const props = feature.properties ?? {};
    const name = cleanOcrText(props.name ?? '');
    if (name.length === 0) {
      dropped.push({ sourceItemId: itemId, reason: 'empty business name after OCR cleanup' });
      return;
    }
    const address = cleanOcrText(props.address ?? '');
    const city = props.city ? titleCase(cleanOcrText(props.city)) : undefined;
    const state = props.state ? titleCase(cleanOcrText(props.state)) : undefined;
    const category = props.category ? cleanOcrText(props.category) : undefined;
    const coords = feature.geometry?.coordinates;
    const placeText = [city, state].filter((part) => part && part.length > 0).join(', ');
    const summary =
      `${category && category.length > 0 ? category : 'Listing'} at ` +
      `${address.length > 0 ? address : 'an unrecorded address'}` +
      `${placeText.length > 0 ? `, ${placeText}` : ''}, listed in the 1947 Negro Motorist ` +
      `Green Book, sourced from NYPL Green Book structured map data.`;
    candidates.push({
      id: `greenbook-${itemId}`,
      kind: 'place',
      displayName: name,
      summary,
      aliases: [],
      canonicalUrl: props.dc_url ?? `${GREENBOOKS_RAW}/${GREENBOOK_1947_PATH}`,
      ...(coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])
        ? { lat: roundCoord(coords[1]), lng: roundCoord(coords[0]) }
        : {}),
      discoveredAt: now,
      researchLaneOnly: true,
      provenance: {
        sourceId: 'nypl-green-book',
        sourceItemId: props.capture_uuid ? `${itemId}:${props.capture_uuid}` : itemId,
        sourceUrl: `${GREENBOOKS_RAW}/${GREENBOOK_1947_PATH}`,
        capturedAt: now,
        editionYear: 1947,
        ...(address.length > 0 ? { historicAddress: address } : {}),
        ...(city ? { sourceCity: city } : {}),
        ...(state ? { sourceState: state } : {}),
        ...(category ? { sourceCategory: category } : {}),
        geoPrecision: greenbookGeoPrecision({
          interpolated: feature.geometry?.interpolated,
          omitted: feature.geometry?.omitted,
          confidence: props.geocoded_confidence,
        }),
        ...(props.geocoded_confidence !== undefined
          ? { geocodedConfidence: Math.round(props.geocoded_confidence * 1000) / 1000 }
          : {}),
        rights,
      },
    });
  });

  data1956.rows.forEach((row, index) => {
    const itemId = `1956-${String(index).padStart(4, '0')}`;
    const [rawName, rawAddress, rawType, , latlng] = row;
    const name = cleanOcrText(rawName ?? '');
    if (name.length === 0) {
      dropped.push({ sourceItemId: itemId, reason: 'empty business name after OCR cleanup' });
      return;
    }
    const address = cleanOcrText(rawAddress ?? '');
    const category = cleanOcrText(rawType ?? '');
    const { city, state } = parseModernAddress(address);
    const summary =
      `${category.length > 0 ? category : 'Listing'} at ` +
      `${address.length > 0 ? address : 'an unrecorded address'}, listed in the 1956 Negro ` +
      `Motorist Green Book, sourced from NYPL Green Book structured map data.`;
    candidates.push({
      id: `greenbook-${itemId}`,
      kind: 'place',
      displayName: name,
      summary,
      aliases: [],
      canonicalUrl: `${GREENBOOKS_RAW}/${GREENBOOK_1956_PATH}`,
      ...(latlng && Number.isFinite(latlng[0]) && Number.isFinite(latlng[1])
        ? { lat: roundCoord(latlng[0]), lng: roundCoord(latlng[1]) }
        : {}),
      discoveredAt: now,
      researchLaneOnly: true,
      provenance: {
        sourceId: 'nypl-green-book',
        sourceItemId: itemId,
        sourceUrl: `${GREENBOOKS_RAW}/${GREENBOOK_1956_PATH}`,
        capturedAt: now,
        editionYear: 1956,
        ...(address.length > 0 ? { historicAddress: address } : {}),
        ...(city ? { sourceCity: city } : {}),
        ...(state ? { sourceState: state } : {}),
        ...(category.length > 0 ? { sourceCategory: category } : {}),
        geoPrecision: greenbookGeoPrecision({}),
        rights,
      },
    });
  });

  return {
    metadata: {
      sourceProgramId: 'nypl-green-book',
      sourceProgramName: 'NYPL Green Book structured map data (1947 and 1956 editions)',
      custodian: 'New York Public Library / Schomburg Center',
      license: rights,
      canonicalUrl: 'https://github.com/NYPL-publicdomain/greenbooks',
      sourceCaptures: [file1947.capture, file1956.capture],
      methodologyNotes: [
        RESEARCH_LANE_NOTE,
        'Deterministic import: no LLM classification, geocoding, or text generation.',
        `Inputs pinned to NYPL-publicdomain/greenbooks commit ${GREENBOOKS_COMMIT}.`,
        '1947 rows come from geojson/1947.geojson (per-listing OCR text with map geocodes); ' +
          '1956 rows from web/public/data/greenbook_1956.json (name/address/type/year/latlng).',
        'Coordinates are OCR/geocode-era and candidate-only; interpolated, map-omitted, and ' +
          'low-confidence geocodes are flagged per row in provenance.geoPrecision.',
        'Historic tourist-home addresses can be present-day residences; privacy review is ' +
          'required before any public pin (workbook safety rule).',
        'Repeated editions of the same business should resolve to one entity with per-edition ' +
          'attestations (workbook methodology rule 12); this file intentionally keeps raw rows.',
      ],
    },
    rowsFetched: geo1947.features.length + data1956.rows.length,
    dropped,
    candidates,
  };
}

// --- Lane: dc-sites --------------------------------------------------------

interface DcSiteFeature {
  readonly geometry?: {
    readonly coordinates?: readonly [number, number];
  } | null;
  readonly properties: {
    readonly UniqueID?: string;
    readonly ObjectId?: number;
    readonly Resource?: string;
    readonly Type?: string;
    readonly Date?: string;
    readonly Address?: string;
    readonly Ward?: string;
    readonly Status?: string;
    readonly Details?: string;
    readonly Hyperlink?: string;
    readonly Lat?: number;
    readonly Lon?: number;
  };
}

interface DcSitesPage {
  readonly type: string;
  readonly features: readonly DcSiteFeature[];
  readonly exceededTransferLimit?: boolean;
}

const DC_ATTRIBUTION =
  '"Black History Sites: Washington" — District of Columbia Office of Planning, Historic ' +
  'Preservation Office. Licensed CC BY 4.0.';

async function fetchDcSitesPages(): Promise<{
  readonly features: readonly DcSiteFeature[];
  readonly captures: readonly SourceCapture[];
}> {
  const pageSize = 1000;
  const features: DcSiteFeature[] = [];
  const captures: SourceCapture[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const url =
      `${DC_SITES_FEATURESERVER}/query?where=1%3D1&outFields=*&outSR=4326&f=geojson` +
      `&resultOffset=${offset}&resultRecordCount=${pageSize}`;
    const page = await fetchRaw(url, 'dc-sites', `features-offset-${offset}.geojson`);
    const parsed = JSON.parse(page.text) as DcSitesPage;
    if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
      throw new Error(`DC sites page at offset ${offset} is not a FeatureCollection`);
    }
    features.push(...parsed.features);
    captures.push(page.capture);
    if (!parsed.exceededTransferLimit && parsed.features.length < pageSize) break;
  }
  return { features, captures };
}

async function runDcSitesLane(now: string): Promise<LaneResult> {
  const { features, captures } = await fetchDcSitesPages();
  const candidates: BulkCandidate[] = [];
  const dropped: DroppedRow[] = [];
  const seenIds = new Set<string>();

  features.forEach((feature, index) => {
    const props = feature.properties ?? {};
    const fallbackId = props.ObjectId !== undefined ? `objectid-${props.ObjectId}` : `row-${index}`;
    const sourceItemId =
      props.UniqueID && props.UniqueID.trim().length > 0 ? props.UniqueID.trim() : fallbackId;
    const name = (props.Resource ?? '').replace(/\s+/g, ' ').trim();
    if (name.length === 0) {
      dropped.push({ sourceItemId, reason: 'empty Resource (site name)' });
      return;
    }
    const id = `dc-black-history-sites-${sourceItemId.toLowerCase()}`;
    if (seenIds.has(id)) {
      dropped.push({ sourceItemId, reason: 'duplicate UniqueID in source layer' });
      return;
    }
    seenIds.add(id);
    const siteType = (props.Type ?? '').trim();
    const address = (props.Address ?? '').replace(/\s+/g, ' ').trim();
    const date = (props.Date ?? '').trim();
    const coords = feature.geometry?.coordinates;
    const lat = coords && Number.isFinite(coords[1]) ? coords[1] : props.Lat;
    const lng = coords && Number.isFinite(coords[0]) ? coords[0] : props.Lon;
    const summary =
      `${siteType.length > 0 ? `${siteType} site` : 'Site'}` +
      `${address.length > 0 ? ` at ${address}` : ''} in Washington, DC` +
      `${date.length > 0 ? ` (${date})` : ''}, documented in the DC Historic Preservation ` +
      `Office "Black History Sites: Washington" inventory.`;
    candidates.push({
      id,
      kind: 'place',
      displayName: name,
      summary,
      aliases: [],
      canonicalUrl:
        props.Hyperlink && props.Hyperlink.trim().startsWith('http')
          ? props.Hyperlink.trim()
          : DC_SITES_CATALOG_URL,
      ...(lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat: roundCoord(lat), lng: roundCoord(lng) }
        : {}),
      discoveredAt: now,
      researchLaneOnly: true,
      provenance: {
        sourceId: 'dc-black-history-sites',
        sourceItemId,
        sourceUrl: `${DC_SITES_FEATURESERVER}/query?where=1%3D1&outFields=*&f=geojson`,
        capturedAt: now,
        ...(address.length > 0 ? { historicAddress: address } : {}),
        sourceCity: 'Washington',
        sourceState: 'DC',
        ...(siteType.length > 0 ? { sourceCategory: siteType } : {}),
        geoPrecision:
          'source ArcGIS point; candidate-only pending geo review (historical homes are not a ' +
          'precedent for exposing a living person’s residence)',
        rights: 'CC BY 4.0',
        attribution: DC_ATTRIBUTION,
      },
    });
  });

  return {
    metadata: {
      sourceProgramId: 'dc-black-history-sites',
      sourceProgramName: 'Black History Sites: Washington',
      custodian: 'District of Columbia Office of Planning / Historic Preservation Office',
      license: 'CC BY 4.0',
      attribution: DC_ATTRIBUTION,
      canonicalUrl: DC_SITES_CATALOG_URL,
      sourceCaptures: captures,
      methodologyNotes: [
        RESEARCH_LANE_NOTE,
        'Deterministic import: no LLM classification, geocoding, or text generation.',
        'Fetched from the "Black History Sites - Points of Interest" hosted feature layer ' +
          `(${DC_SITES_FEATURESERVER}), the operational layer of the StoryMap that the ` +
          'data.gov catalog entry resolves to.',
        'CC BY 4.0: retain the attribution string on any derived or published record.',
        'Rows typed "People" are sites associated with historical figures (homes, workplaces); ' +
          'they remain place candidates and are subject to the workbook privacy rules.',
      ],
    },
    rowsFetched: features.length,
    dropped,
    candidates,
  };
}

// --- Entry point -----------------------------------------------------------

async function main(): Promise<void> {
  const lane = arg('lane');
  if (lane !== 'greenbook' && lane !== 'dc-sites') {
    console.error('Usage: import-bulk-source-programs.ts --lane=greenbook|dc-sites');
    process.exit(2);
  }
  const now = new Date().toISOString();
  const result = lane === 'greenbook' ? await runGreenbookLane(now) : await runDcSitesLane(now);

  const ids = new Set(result.candidates.map((candidate) => candidate.id));
  if (ids.size !== result.candidates.length) {
    throw new Error(`duplicate candidate ids in ${lane} output`);
  }

  const fixture: BulkFixture = {
    generatedAt: now,
    metadata: {
      ...result.metadata,
      retrievedAt: now,
      count: result.candidates.length,
      droppedCount: result.dropped.length,
    },
    summary: {
      rowsFetched: result.rowsFetched,
      newCandidates: result.candidates.length,
      skippedUnusable: result.dropped.length,
    },
    dropped: result.dropped,
    candidates: result.candidates,
  };

  mkdirSync(CANDIDATES_DIR, { recursive: true });
  const outPath = join(CANDIDATES_DIR, `bulk-${lane}-${now.slice(0, 10)}.json`);
  writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`Lane: ${lane}`);
  console.log(`Rows fetched: ${result.rowsFetched}`);
  console.log(`Candidates written: ${result.candidates.length}`);
  console.log(`Dropped: ${result.dropped.length}`);
  for (const drop of result.dropped) {
    console.log(`  - ${drop.sourceItemId}: ${drop.reason}`);
  }
  console.log(`Wrote ${outPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
