/**
 * Research-only place-coordinate enrichment for national-catalog named places.
 *
 * Durability contract (binding):
 *  - Live Wikidata/Census are enrichment inputs only.
 *  - Every accepted pin is written to git-durable
 *    `fixtures/national-catalog-location-overrides.json`.
 *  - Raw API JSON is archived under `.cache/wikidata-entities/` for local replay.
 *  - Publish/map read overrides + EntityLocation — never live geocoders.
 *
 * Usage:
 *   node --conditions development --import tsx packages/firebase/scripts/enrich-entity-locations.ts \
 *     [--limit=N] [--apply]
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  US_STATES,
  buildCensusGeocodeQuery,
  classifyLocationEvidence,
  coordinateFromWikidataEntity,
  createCommonsMediaClient,
  decideLocationCorrection,
  fetchCensusAddressGeocode,
  haversineMeters,
  normalizeAddressInput,
  placeTitleCandidatesFromLabel,
  isJurisdictionOnlyPlaceTitle,
  type SafeHttpClient,
} from '@repo/domain';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../fixtures');
const CATALOG_DIR = join(ROOT, 'national-catalog');
const OVERRIDES_PATH = join(ROOT, 'national-catalog-location-overrides.json');
const WIKIDATA_CACHE_DIR = join(process.cwd(), '.cache/wikidata-entities');
const CENSUS_CACHE_PATH = join(process.cwd(), '.cache/geocode-census.json');
const REPORT_PATH = join(process.cwd(), '.cache/location-enrichment-report.json');

type OverrideRecord = {
  readonly lat: number;
  readonly lng: number;
  readonly precision: string;
  readonly matchMethod: 'geocode_census' | 'geocode_other' | 'manual_research';
  readonly source: 'census' | 'wikidata_p625' | 'manual_retained';
  readonly wikidataId?: string;
  readonly matchedAddress?: string;
  readonly contentHash: string;
  readonly retrievedAt: string;
  readonly notes?: string;
};

type OverridesFile = {
  readonly version: 1;
  readonly generatedAt: string;
  readonly note: string;
  readonly overrides: Record<string, OverrideRecord>;
};

type CatalogEntry = {
  id: string;
  displayName: string;
  locationLabel: string;
  locationPrecision: string;
  jurisdictionLabel: string;
  lat: number;
  lng: number;
  file: string;
  index: number;
};

const STATE_BY_NAME = new Map(US_STATES.map((s) => [s.name.toLowerCase(), s]));
const STATE_BY_POSTAL = new Map(US_STATES.map((s) => [s.postalCode, s]));

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function stateFor(jurisdictionLabel: string) {
  const tail = jurisdictionLabel.split(',').pop()?.trim() ?? '';
  if (/^d\.?c\.?$/i.test(tail) || /district of columbia/i.test(tail)) {
    return STATE_BY_POSTAL.get('DC');
  }
  return STATE_BY_NAME.get(tail.toLowerCase()) ?? STATE_BY_POSTAL.get(tail.toUpperCase());
}

function outsideStateBbox(lat: number, lng: number, jurisdictionLabel: string): boolean {
  const state = stateFor(jurisdictionLabel);
  if (!state) return false;
  const [west, south, east, north] = state.bbox;
  return lat < south || lat > north || lng < west || lng > east;
}

function loadCatalog(): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  for (const file of readdirSync(CATALOG_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const entries = JSON.parse(readFileSync(join(CATALOG_DIR, file), 'utf8')) as Array<
      Record<string, unknown>
    >;
    entries.forEach((raw, index) => {
      out.push({
        id: String(raw.id),
        displayName: String(raw.displayName),
        locationLabel: String(raw.locationLabel),
        locationPrecision: String(raw.locationPrecision),
        jurisdictionLabel: String(raw.jurisdictionLabel),
        lat: Number(raw.lat),
        lng: Number(raw.lng),
        file,
        index,
      });
    });
  }
  return out;
}

function loadOverrides(): OverridesFile {
  if (!existsSync(OVERRIDES_PATH)) {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      note: 'Git-durable accepted pins. Publish prefers these after Firestore EntityLocation.',
      overrides: {},
    };
  }
  return JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8')) as OverridesFile;
}

function hashPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function archiveJson(dir: string, key: string, payload: unknown): string {
  mkdirSync(dir, { recursive: true });
  const contentHash = hashPayload(payload);
  const path = join(dir, `${key}-${contentHash.slice(0, 12)}.json`);
  if (!existsSync(path)) {
    writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  }
  return contentHash;
}

const censusHttpClient: SafeHttpClient = async (request) => {
  const response = await fetch(request.url, {
    method: request.method ?? 'GET',
    headers: request.headers,
  });
  const bodyText = await response.text();
  const headers: Record<string, string | undefined> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return { status: response.status, headers, bodyText, finalUrl: response.url };
};

type CensusCacheFile = {
  readonly version: 1;
  readonly entries: Record<
    string,
    {
      readonly query: string;
      readonly fetchedAt: string;
      readonly match: {
        readonly lat: number;
        readonly lng: number;
        readonly matchedAddress?: string;
        readonly stateName?: string;
      } | null;
    }
  >;
};

function loadCensusCache(): CensusCacheFile {
  if (!existsSync(CENSUS_CACHE_PATH)) return { version: 1, entries: {} };
  return JSON.parse(readFileSync(CENSUS_CACHE_PATH, 'utf8')) as CensusCacheFile;
}

function saveCensusCache(cache: CensusCacheFile): void {
  mkdirSync(dirname(CENSUS_CACHE_PATH), { recursive: true });
  writeFileSync(CENSUS_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
}

async function censusLookup(
  query: string,
  cache: CensusCacheFile,
): Promise<NonNullable<CensusCacheFile['entries'][string]['match']> | null> {
  const normalized = normalizeAddressInput(query);
  if (!normalized.queryText) return null;
  const key = createHash('sha256').update(normalized.cacheKey).digest('hex').slice(0, 32);
  const hit = cache.entries[key];
  if (hit) return hit.match;
  const matches = await fetchCensusAddressGeocode({
    address: normalized.queryText,
    client: censusHttpClient,
  });
  const best = matches.length === 1 ? matches[0] : undefined;
  const match = best
    ? {
        lat: best.lat,
        lng: best.lng,
        ...(best.matchedAddress ? { matchedAddress: best.matchedAddress } : {}),
        ...(best.stateName ? { stateName: best.stateName } : {}),
      }
    : null;
  cache.entries[key] = {
    query: normalized.queryText,
    fetchedAt: new Date().toISOString(),
    match,
  };
  await new Promise((r) => setTimeout(r, 100));
  return match;
}

async function main(): Promise<void> {
  const apply = hasFlag('apply');
  const limit = arg('limit') ? Number(arg('limit')) : undefined;
  let entries = loadCatalog();
  if (limit !== undefined && Number.isFinite(limit)) entries = entries.slice(0, limit);

  const overridesFile = loadOverrides();
  const censusCache = loadCensusCache();
  const client = createCommonsMediaClient({
    userAgent: 'BlackStoryLocationEnrichment/1.0 (research; mailto:ops@blackstory.app)',
    batchDelayMs: 250,
  });

  const report: Array<Record<string, unknown>> = [];
  let censusApplied = 0;
  let wikidataApplied = 0;
  let retained = 0;
  let downgraded = 0;
  let unresolved = 0;

  // Collect place titles for named_place candidates missing an override.
  const namedCandidates = entries.filter((entry) => {
    if (overridesFile.overrides[entry.id]) return false;
    return (
      classifyLocationEvidence({
        locationLabel: entry.locationLabel,
        locationPrecision: entry.locationPrecision,
      }) === 'named_place'
    );
  });

  const titles = namedCandidates.flatMap((e) => [
    ...placeTitleCandidatesFromLabel(e.locationLabel),
  ]);
  const uniqueTitles = [...new Set(titles.filter((t) => t.length >= 3))];
  console.log(
    `Resolving ${uniqueTitles.length} enwiki titles for ${namedCandidates.length} named places…`,
  );
  const resolved = await client.resolveEnwikiTitles(uniqueTitles);
  const titleToQid = new Map<string, string>();
  for (const row of resolved) {
    if (row.wikidataId && !row.missing) {
      titleToQid.set(row.title.replace(/_/g, ' ').trim().toLowerCase(), row.wikidataId);
    }
  }
  const qids = [...new Set(titleToQid.values())];
  const entities = qids.length > 0 ? await client.fetchEntitiesById(qids) : new Map();

  // Archive raw entity payloads for durability/replay.
  for (const [qid, entity] of entities) {
    archiveJson(WIKIDATA_CACHE_DIR, qid, entity);
  }

  for (const entry of entries) {
    if (overridesFile.overrides[entry.id]) {
      retained += 1;
      continue;
    }

    const evidence = classifyLocationEvidence({
      locationLabel: entry.locationLabel,
      locationPrecision: entry.locationPrecision,
    });
    const retrievedAt = new Date().toISOString();

    // 1) Street / rescued street via Census
    if (evidence === 'street_address' || /\b\d{1,5}/.test(entry.locationLabel)) {
      const query = buildCensusGeocodeQuery(entry.locationLabel, entry.jurisdictionLabel);
      const match = await censusLookup(query, censusCache);
      if (match) {
        const decision = decideLocationCorrection({
          entityId: entry.id,
          locationLabel: entry.locationLabel,
          locationPrecision:
            entry.locationPrecision === 'city' ? 'institution' : entry.locationPrecision,
          jurisdictionLabel: entry.jurisdictionLabel,
          stored: { lat: entry.lat, lng: entry.lng },
          outsideStateBbox: outsideStateBbox(entry.lat, entry.lng, entry.jurisdictionLabel),
          geocode: {
            lat: match.lat,
            lng: match.lng,
            method: 'geocode_census',
            ...(match.matchedAddress ? { matchedAddress: match.matchedAddress } : {}),
            ...(match.stateName ? { stateName: match.stateName } : {}),
          },
        });
        if (decision.action === 'correct_coordinates' && decision.corrected) {
          const payload = { source: 'census', match, decision };
          const contentHash = hashPayload(payload);
          overridesFile.overrides[entry.id] = {
            lat: Math.round(decision.corrected.lat * 1e5) / 1e5,
            lng: Math.round(decision.corrected.lng * 1e5) / 1e5,
            precision: decision.suggestedPrecision,
            matchMethod: 'geocode_census',
            source: 'census',
            contentHash,
            retrievedAt,
            ...(decision.matchedAddress ? { matchedAddress: decision.matchedAddress } : {}),
            notes: decision.reason,
          };
          censusApplied += 1;
          report.push({ id: entry.id, action: 'census_override', decision });
          continue;
        }
      }
    }

    // 2) Wikidata P625 for named places (try head + parent-site title candidates)
    if (evidence === 'named_place') {
      const PARENT_SITE =
        /\b(university|college|hospital|cemetery|museum|library|space center|research center|air force base|naval|fort|park|church|cathedral|institute|academy|refuge|plantation|battlefield)\b/i;
      /** Parent-site snaps only — never yank a pin to a city/state centroid. */
      const MAX_PARENT_SNAP_METERS = 15_000;

      let matched:
        | {
            qid: string;
            coord: NonNullable<ReturnType<typeof coordinateFromWikidataEntity>>;
            title: string;
            isParentSite: boolean;
          }
        | undefined;
      for (const title of placeTitleCandidatesFromLabel(entry.locationLabel)) {
        if (isJurisdictionOnlyPlaceTitle(title)) continue;
        const titleKey = title.replace(/_/g, ' ').trim().toLowerCase();
        const qid = titleToQid.get(titleKey);
        const entity = qid ? entities.get(qid) : undefined;
        const coord = entity && qid ? coordinateFromWikidataEntity(entity, qid) : undefined;
        if (coord && qid && !outsideStateBbox(coord.lat, coord.lng, entry.jurisdictionLabel)) {
          matched = { qid, coord, title, isParentSite: PARENT_SITE.test(title) };
          break;
        }
      }

      if (matched) {
        const { coord, title, isParentSite } = matched;
        const drift = Math.round(haversineMeters({ lat: entry.lat, lng: entry.lng }, coord));
        const precision =
          entry.locationPrecision === 'institution' ? 'campus' : entry.locationPrecision;

        if (drift <= 500) {
          overridesFile.overrides[entry.id] = {
            lat: Math.round(entry.lat * 1e5) / 1e5,
            lng: Math.round(entry.lng * 1e5) / 1e5,
            precision: entry.locationPrecision,
            matchMethod: 'geocode_other',
            source: 'wikidata_p625',
            wikidataId: coord.wikidataId,
            contentHash: hashPayload({
              qid: coord.wikidataId,
              coord,
              drift,
              mode: 'confirm',
              title,
            }),
            retrievedAt,
            notes: `manual_research confirmed by Wikidata P625 within ${drift}m (${coord.wikidataId}; title "${title}")`,
          };
          wikidataApplied += 1;
          report.push({
            id: entry.id,
            action: 'wikidata_confirm',
            drift,
            qid: coord.wikidataId,
            title,
          });
          continue;
        }

        if (isParentSite && drift > 1600 && drift <= MAX_PARENT_SNAP_METERS) {
          overridesFile.overrides[entry.id] = {
            lat: Math.round(coord.lat * 1e5) / 1e5,
            lng: Math.round(coord.lng * 1e5) / 1e5,
            precision,
            matchMethod: 'geocode_other',
            source: 'wikidata_p625',
            wikidataId: coord.wikidataId,
            contentHash: hashPayload({ qid: coord.wikidataId, coord, drift, mode: 'snap', title }),
            retrievedAt,
            notes: `Wikidata P625 adopted via parent site "${title}"; prior pin was ${drift}m away (${coord.wikidataId})`,
          };
          wikidataApplied += 1;
          report.push({
            id: entry.id,
            action: 'wikidata_snap',
            drift,
            qid: coord.wikidataId,
            title,
          });
          continue;
        }

        // Mid-range / non-parent disagreement: keep manual pin; honesty-downgrade institution → campus.
        overridesFile.overrides[entry.id] = {
          lat: entry.lat,
          lng: entry.lng,
          precision: entry.locationPrecision === 'institution' ? 'campus' : entry.locationPrecision,
          matchMethod: 'manual_research',
          source: 'manual_retained',
          wikidataId: coord.wikidataId,
          contentHash: hashPayload({ retained: true, drift, qid: coord.wikidataId, title }),
          retrievedAt,
          notes: `Retained manual pin; Wikidata ${coord.wikidataId} ("${title}") ${drift}m away — precision held at ${
            entry.locationPrecision === 'institution' ? 'campus' : entry.locationPrecision
          }`,
        };
        if (entry.locationPrecision === 'institution') {
          downgraded += 1;
          report.push({
            id: entry.id,
            action: 'downgrade_campus',
            drift,
            qid: coord.wikidataId,
            title,
          });
        } else {
          retained += 1;
          report.push({
            id: entry.id,
            action: 'manual_retained_midrange',
            drift,
            qid: coord.wikidataId,
            title,
          });
        }
        continue;
      }
    }

    // 3) Unresolved named places: durable honesty note (institution → campus).
    if (
      evidence === 'named_place' &&
      (entry.locationPrecision === 'institution' || entry.locationPrecision === 'campus')
    ) {
      const honestyPrecision =
        entry.locationPrecision === 'institution' ? 'campus' : entry.locationPrecision;
      overridesFile.overrides[entry.id] = {
        lat: entry.lat,
        lng: entry.lng,
        precision: honestyPrecision,
        matchMethod: 'manual_research',
        source: 'manual_retained',
        contentHash: hashPayload({
          unresolved: true,
          label: entry.locationLabel,
          precision: honestyPrecision,
        }),
        retrievedAt,
        notes:
          entry.locationPrecision === 'institution'
            ? 'No Census/Wikidata confirmation — retained pin, honesty-downgraded institution→campus pending human/NRHP review'
            : 'No Census/Wikidata confirmation — retained campus pin pending human/NRHP review',
      };
      unresolved += 1;
      if (entry.locationPrecision === 'institution') downgraded += 1;
      report.push({
        id: entry.id,
        action: 'unresolved_named_place',
        label: entry.locationLabel,
        precision: honestyPrecision,
      });
      continue;
    }

    retained += 1;
  }

  saveCensusCache(censusCache);

  const summary = {
    total: entries.length,
    censusApplied,
    wikidataApplied,
    downgraded,
    unresolved,
    alreadyHadOverride: Object.keys(overridesFile.overrides).length,
    retainedWithoutChange: retained,
  };

  if (apply) {
    const out: OverridesFile = {
      version: 1,
      generatedAt: new Date().toISOString(),
      note:
        'Git-durable accepted pins from Census/Wikidata enrichment. ' +
        'Publish prefers these after Firestore EntityLocation. Raw Wikidata JSON under .cache/wikidata-entities/.',
      overrides: overridesFile.overrides,
    };
    writeFileSync(OVERRIDES_PATH, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`Wrote ${Object.keys(out.overrides).length} overrides → ${OVERRIDES_PATH}`);
  } else {
    console.log('Dry run (pass --apply to write overrides fixture).');
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
