/**
 * Batch-audit national-catalog (or Firestore export) entity coordinates against the
 * Census Geocoder. Deterministic, cached, no LLM.
 *
 * 1. Classify each label (street / named place / area-only)
 * 2. Geocode street + named-place queries via Census (file cache keyed on normalized text)
 * 3. Decide keep / correct / downgrade / review via @repo/domain location-audit policy
 * 4. Write a JSON report; optionally patch fixture files for high-confidence street corrections
 *
 * Usage:
 *   node --conditions development --import tsx packages/firebase/scripts/audit-entity-locations.ts \
 *     [--dir=packages/firebase/fixtures/national-catalog] \
 *     [--cache=.cache/geocode-census.json] \
 *     [--report=.cache/location-audit-report.json] \
 *     [--apply-street-corrections] \
 *     [--limit=N]
 *
 * Exit 0 always after writing the report (corrections are opt-in). Exit 2 on hard I/O failure.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  US_STATES,
  decideLocationCorrection,
  fetchCensusAddressGeocode,
  normalizeAddressInput,
  buildCensusGeocodeQuery,
  type LocationCorrectionDecision,
  type SafeHttpClient,
} from '@repo/domain';

const DEFAULT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/national-catalog');
const DEFAULT_CACHE = join(process.cwd(), '.cache/geocode-census.json');
const DEFAULT_REPORT = join(process.cwd(), '.cache/location-audit-report.json');

type CatalogEntry = {
  id: string;
  displayName: string;
  kind: string;
  locationLabel: string;
  locationPrecision: string;
  jurisdictionLabel: string;
  lat: number;
  lng: number;
  file: string;
  index: number;
};

type CacheEntry = {
  readonly query: string;
  readonly fetchedAt: string;
  readonly match: {
    readonly lat: number;
    readonly lng: number;
    readonly matchedAddress?: string;
    readonly stateName?: string;
  } | null;
};

type CacheFile = {
  readonly version: 1;
  readonly entries: Record<string, CacheEntry>;
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

function loadCache(path: string): CacheFile {
  if (!existsSync(path)) return { version: 1, entries: {} };
  return JSON.parse(readFileSync(path, 'utf8')) as CacheFile;
}

function saveCache(path: string, cache: CacheFile): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(cache, null, 2)}\n`);
}

function cacheKey(queryText: string): string {
  return createHash('sha256').update(queryText.toUpperCase()).digest('hex').slice(0, 32);
}

/** Minimal SafeHttpClient for Census (public HTTPS JSON only). */
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
  return {
    status: response.status,
    headers,
    bodyText,
    finalUrl: response.url,
  };
};

function loadCatalog(dir: string): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const entries = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Array<
      Record<string, unknown>
    >;
    entries.forEach((raw, index) => {
      out.push({
        id: String(raw.id),
        displayName: String(raw.displayName),
        kind: String(raw.kind),
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

async function geocodeCached(query: string, cache: CacheFile): Promise<CacheEntry['match']> {
  const normalized = normalizeAddressInput(query);
  if (!normalized.queryText) return null;
  const key = cacheKey(normalized.cacheKey);
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
  return match;
}

async function main(): Promise<void> {
  const dir = arg('dir') ?? DEFAULT_DIR;
  const cachePath = arg('cache') ?? DEFAULT_CACHE;
  const reportPath = arg('report') ?? DEFAULT_REPORT;
  const limit = arg('limit') ? Number(arg('limit')) : undefined;
  const applyStreet = hasFlag('apply-street-corrections');

  let entries = loadCatalog(dir);
  if (limit !== undefined && Number.isFinite(limit)) {
    entries = entries.slice(0, limit);
  }

  const cache = loadCache(cachePath);
  const decisions: LocationCorrectionDecision[] = [];
  let cacheHits = 0;
  const cacheSizeBefore = Object.keys(cache.entries).length;

  for (const entry of entries) {
    const query = buildCensusGeocodeQuery(entry.locationLabel, entry.jurisdictionLabel);
    const sizeBefore = Object.keys(cache.entries).length;
    const match = await geocodeCached(query, cache);
    if (Object.keys(cache.entries).length === sizeBefore) cacheHits += 1;

    const decision = decideLocationCorrection({
      entityId: entry.id,
      locationLabel: entry.locationLabel,
      locationPrecision: entry.locationPrecision,
      jurisdictionLabel: entry.jurisdictionLabel,
      stored: { lat: entry.lat, lng: entry.lng },
      outsideStateBbox: outsideStateBbox(entry.lat, entry.lng, entry.jurisdictionLabel),
      ...(match
        ? {
            geocode: {
              lat: match.lat,
              lng: match.lng,
              method: 'geocode_census' as const,
              ...(match.matchedAddress ? { matchedAddress: match.matchedAddress } : {}),
              ...(match.stateName ? { stateName: match.stateName } : {}),
            },
          }
        : {}),
    });
    decisions.push(decision);
    // Be polite to the free Census service when we actually hit the network.
    if (Object.keys(cache.entries).length > sizeBefore) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  saveCache(cachePath, cache);

  const summary = {
    total: decisions.length,
    keep: decisions.filter((d) => d.action === 'keep').length,
    correct_coordinates: decisions.filter((d) => d.action === 'correct_coordinates').length,
    downgrade_precision: decisions.filter((d) => d.action === 'downgrade_precision').length,
    review: decisions.filter((d) => d.action === 'review').length,
    cacheHits,
    cacheEntries: Object.keys(cache.entries).length,
    newCacheEntries: Object.keys(cache.entries).length - cacheSizeBefore,
  };

  const byId = new Map(entries.map((e) => [e.id, e]));
  const report = {
    generatedAt: new Date().toISOString(),
    summary,
    decisions: decisions.map((d) => {
      const entry = byId.get(d.entityId);
      return {
        ...d,
        displayName: entry?.displayName,
        file: entry?.file,
        stored: entry ? { lat: entry.lat, lng: entry.lng } : undefined,
        locationLabel: entry?.locationLabel,
        locationPrecision: entry?.locationPrecision,
      };
    }),
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report: ${reportPath}`);
  console.log(`Cache:  ${cachePath}`);

  if (applyStreet) {
    const corrections = decisions.filter(
      (d) =>
        d.action === 'correct_coordinates' &&
        d.evidenceClass === 'street_address' &&
        d.corrected &&
        d.matchMethod === 'geocode_census',
    );
    const byFile = new Map<
      string,
      Array<{ index: number; id: string; lat: number; lng: number; drift?: number }>
    >();
    for (const decision of corrections) {
      const entry = byId.get(decision.entityId);
      if (!entry || !decision.corrected) continue;
      const list = byFile.get(entry.file) ?? [];
      list.push({
        index: entry.index,
        id: entry.id,
        lat: Math.round(decision.corrected.lat * 1e5) / 1e5,
        lng: Math.round(decision.corrected.lng * 1e5) / 1e5,
        ...(decision.driftMeters !== undefined ? { drift: decision.driftMeters } : {}),
      });
      byFile.set(entry.file, list);
    }
    for (const [file, patches] of byFile) {
      const path = join(dir, file);
      const raw = JSON.parse(readFileSync(path, 'utf8')) as Array<Record<string, unknown>>;
      for (const patch of patches) {
        const row = raw[patch.index];
        if (!row || row.id !== patch.id) {
          console.error(`Skip ${patch.id}: index/id mismatch in ${file}`);
          continue;
        }
        const priorLat = row.lat;
        const priorLng = row.lng;
        row.lat = patch.lat;
        row.lng = patch.lng;
        console.log(
          `Corrected ${patch.id}: ${priorLat},${priorLng} → ${patch.lat},${patch.lng}` +
            (patch.drift !== undefined ? ` (${patch.drift}m)` : ''),
        );
      }
      writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`);
    }
    console.log(`Applied ${corrections.length} street corrections across ${byFile.size} file(s).`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
