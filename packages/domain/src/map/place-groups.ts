/**
 * Place grouping for the public map: records are grouped by the place they belong to (state,
 * county, city), never by how close their dots fall on screen. Binding spec:
 * `docs/ui/patterns-place-map.md`.
 *
 * Pure and geometry-free. Callers inject the two lookups that need reference geometry (the
 * county containing a point, a state's label point), so web and mobile can share the rules and
 * bring their own geodata. Every coordinate read here is the record's already-redacted public
 * point; nothing in this module sharpens a location.
 */

/** The four levels a reader moves through as the camera closes in. */
export type PlaceLevel = 'state' | 'county' | 'city' | 'site';

/**
 * The integer zoom each level starts at. Integers on purpose: MapLibre evaluates zoom inside a
 * layer filter at integer zoom levels only, so a fractional threshold would not hold.
 * State until 6 (national and regional frames), county from 6 (a single-state frame, where state
 * labels hand off to county names), city from 8 (a metro frame), sites from 11 (a city's streets).
 */
export const PLACE_LEVEL_MIN_ZOOM: Readonly<Record<PlaceLevel, number>> = {
  state: 0,
  county: 6,
  city: 8,
  site: 11,
};

/** Never inside the map's zoom range: a feature carrying it stays in the source, undrawn. */
export const PLACE_NEVER_ZOOM = 99;

/**
 * How finely the archive holds a record's place, in four bands. The single precision table for
 * every map surface (the web mark `dot | ring | none` is derived from it).
 */
export type PrecisionBand = 'site' | 'area' | 'county' | 'state';

const PRECISION_BANDS: Readonly<Record<string, PrecisionBand>> = {
  address: 'site',
  site: 'site',
  institution: 'site',
  campus: 'area',
  neighborhood: 'area',
  city: 'area',
  county: 'county',
  state: 'state',
  country: 'state',
};

/** Every precision the band table classifies. */
export const CLASSIFIED_PRECISIONS: readonly string[] = Object.keys(PRECISION_BANDS);

/** Unclassified precisions fail soft to `area`: never drawn as a site, never sharpened. */
export function precisionBandFor(precision: string): PrecisionBand {
  return PRECISION_BANDS[precision] ?? 'area';
}

export type PlaceRecordInput = {
  readonly id: string;
  /** The record's public (redacted) point. */
  readonly lng: number;
  readonly lat: number;
  readonly precision: string;
  readonly statePostalCode?: string;
  readonly stateName?: string;
  /** Editorial "City, State" label. The city is the segment before the state. */
  readonly jurisdictionLabel?: string;
};

export type CountyRef = {
  /** Five-digit state+county FIPS. */
  readonly fips: string;
  /** Display name with its suffix ("Fulton County", "Orleans Parish"). */
  readonly name: string;
  /** Canonical anchor derived from the county geometry, never from a record. */
  readonly anchor: readonly [number, number];
};

export type PlaceLookups = {
  readonly countyAt?: (lng: number, lat: number) => CountyRef | undefined;
  readonly stateAnchor: (postalCode: string) => readonly [number, number] | undefined;
};

export type PlacePath = {
  readonly band: PrecisionBand;
  readonly state?: string;
  readonly county?: string;
  readonly city?: string;
};

/** A place a record belongs to, keyed by the slug `?place=` carries. */
export type PlaceInfo = {
  readonly key: string;
  readonly level: Exclude<PlaceLevel, 'site'>;
  readonly name: string;
  readonly anchor: readonly [number, number];
};

export type PlaceBreakdown = {
  readonly site: number;
  readonly area: number;
  readonly county: number;
  readonly state: number;
};

/** One grouped mark on the map: a place, at one level, holding `memberIds`. */
export type PlaceToken = {
  readonly id: string;
  readonly placeKey: string;
  readonly level: Exclude<PlaceLevel, 'site'>;
  readonly name: string;
  readonly anchor: readonly [number, number];
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly memberIds: readonly string[];
  readonly breakdown: PlaceBreakdown;
  /** Member extent `[west, south, east, north]`, for framing the place. */
  readonly bounds: readonly [number, number, number, number];
};

/** A site-precision record drawn on its own from the site level, with its spread position. */
export type SiteMark = {
  readonly id: string;
  readonly truePoint: readonly [number, number];
  /** Equal to `truePoint` unless the site shares its coordinate with other sites. */
  readonly drawnPoint: readonly [number, number];
};

export type PlaceGroups = {
  readonly tokens: readonly PlaceToken[];
  readonly sites: readonly SiteMark[];
  readonly places: ReadonlyMap<string, PlaceInfo>;
  readonly pathById: ReadonlyMap<string, PlacePath>;
};

const STATE_LIKE = /\b(county|parish|borough|census area)\b/i;

function slug(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The city a record's jurisdiction label names: the segment just before the state ("Harlem,
 * New York City, New York" is New York City). No city when the label names only a state or a
 * county. D.C. is one city by definition.
 */
export function cityFromJurisdictionLabel(
  label: string | undefined,
  statePostalCode: string | undefined,
): string | undefined {
  if (statePostalCode === 'DC') return 'Washington';
  const segments = (label ?? '')
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length < 2) return undefined;
  const city = segments[segments.length - 2]!;
  return STATE_LIKE.test(city) ? undefined : city;
}

export function stateKey(postalCode: string): string {
  return `state-${postalCode.toLowerCase()}`;
}
export function countyKey(fips: string): string {
  return `county-${fips}`;
}
export function cityKey(postalCode: string, city: string): string {
  return `city-${postalCode.toLowerCase()}-${slug(city)}`;
}

/** Where a record sits in the hierarchy. County and state records never get a city. */
export function placePathFor(record: PlaceRecordInput, lookups: PlaceLookups): PlacePath {
  const band = precisionBandFor(record.precision);
  const postal = record.statePostalCode;
  if (!postal) return { band };
  const county = band === 'state' ? undefined : lookups.countyAt?.(record.lng, record.lat);
  const city =
    band === 'site' || band === 'area'
      ? cityFromJurisdictionLabel(record.jurisdictionLabel, postal)
      : undefined;
  return {
    band,
    state: stateKey(postal),
    ...(county ? { county: countyKey(county.fips) } : {}),
    ...(city ? { city: cityKey(postal, city) } : {}),
  };
}

/**
 * The place a record is counted in at one level: its deepest known place no finer than the
 * level. At the site level, a site record is drawn on its own (undefined here).
 */
export function placeAtLevel(path: PlacePath, level: PlaceLevel): string | undefined {
  if (level === 'site' && path.band === 'site') return undefined;
  if (level === 'state') return path.state;
  if (level === 'county') return path.county ?? path.state;
  return path.city ?? path.county ?? path.state;
}

/** Whether a record belongs to a place (inclusive: a city's records are its county's too). */
export function pathIncludes(path: PlacePath, placeKey: string): boolean {
  return path.state === placeKey || path.county === placeKey || path.city === placeKey;
}

const LEVELS: readonly PlaceLevel[] = ['state', 'county', 'city', 'site'];

function levelRange(level: PlaceLevel): { minZoom: number; maxZoom: number } {
  const index = LEVELS.indexOf(level);
  const next = LEVELS[index + 1];
  return {
    minZoom: PLACE_LEVEL_MIN_ZOOM[level],
    maxZoom: next ? PLACE_LEVEL_MIN_ZOOM[next] : PLACE_NEVER_ZOOM,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** City-scale rounding (about a kilometer): a city anchor never reads as a street address. */
function cityScale(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Spread step for coincident sites, in degrees of longitude: 14px at the site level's first
 * zoom (360 degrees over 256px tiles times 2^11). Spacing grows as the reader zooms in.
 */
export const SITE_SPREAD_STEP_DEG = (14 * 360) / (256 * 2 ** PLACE_LEVEL_MIN_ZOOM.site);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Coincident sites spread on a Fermat spiral around their shared true point, ordered by record
 * id so the layout never changes between renders. The true point itself is never moved.
 */
function spreadSites(
  sites: readonly { id: string; point: readonly [number, number] }[],
): SiteMark[] {
  const byPoint = new Map<string, { id: string; point: readonly [number, number] }[]>();
  for (const site of sites) {
    const key = `${site.point[0].toFixed(5)},${site.point[1].toFixed(5)}`;
    const group = byPoint.get(key) ?? [];
    group.push(site);
    byPoint.set(key, group);
  }
  const marks: SiteMark[] = [];
  for (const group of byPoint.values()) {
    if (group.length === 1) {
      marks.push({ id: group[0]!.id, truePoint: group[0]!.point, drawnPoint: group[0]!.point });
      continue;
    }
    const ordered = [...group].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    ordered.forEach((site, index) => {
      const [lng, lat] = site.point;
      const radius = SITE_SPREAD_STEP_DEG * Math.sqrt(index + 1);
      const angle = index * GOLDEN_ANGLE;
      const latScale = Math.cos((lat * Math.PI) / 180);
      marks.push({
        id: site.id,
        truePoint: site.point,
        drawnPoint: [lng + radius * Math.cos(angle), lat + radius * Math.sin(angle) * latScale],
      });
    });
  }
  return marks;
}

/** Group records into place tokens for every level, plus the site marks drawn on their own. */
export function buildPlaceGroups(
  records: readonly PlaceRecordInput[],
  lookups: PlaceLookups,
): PlaceGroups {
  const places = new Map<string, PlaceInfo>();
  const pathById = new Map<string, PlacePath>();
  const cityPoints = new Map<string, { area: [number, number][]; all: [number, number][] }>();
  const cityNames = new Map<string, string>();
  const sites: { id: string; point: readonly [number, number] }[] = [];

  for (const record of records) {
    const path = placePathFor(record, lookups);
    pathById.set(record.id, path);
    if (path.band === 'site') sites.push({ id: record.id, point: [record.lng, record.lat] });
    const postal = record.statePostalCode;
    if (!postal || !path.state) continue;
    if (!places.has(path.state)) {
      const anchor = lookups.stateAnchor(postal);
      if (anchor) {
        places.set(path.state, {
          key: path.state,
          level: 'state',
          name: record.stateName ?? postal,
          anchor,
        });
      }
    }
    if (path.county && !places.has(path.county)) {
      const county = lookups.countyAt?.(record.lng, record.lat);
      if (county) {
        places.set(path.county, {
          key: path.county,
          level: 'county',
          name: `${county.name}, ${postal}`,
          anchor: county.anchor,
        });
      }
    }
    if (path.city) {
      const points = cityPoints.get(path.city) ?? { area: [], all: [] };
      points.all.push([record.lng, record.lat]);
      if (path.band === 'area') points.area.push([record.lng, record.lat]);
      cityPoints.set(path.city, points);
      if (!cityNames.has(path.city)) {
        cityNames.set(
          path.city,
          `${cityFromJurisdictionLabel(record.jurisdictionLabel, postal)}, ${postal}`,
        );
      }
    }
  }

  // A city's anchor is the middle of its city-scale records (the geocoded city point they
  // share), else the middle of all its records, rounded to city scale either way.
  for (const [key, points] of cityPoints) {
    const source = points.area.length > 0 ? points.area : points.all;
    places.set(key, {
      key,
      level: 'city',
      name: cityNames.get(key)!,
      anchor: [
        cityScale(median(source.map(([lng]) => lng))),
        cityScale(median(source.map(([, lat]) => lat))),
      ],
    });
  }

  const tokens: PlaceToken[] = [];
  for (const level of LEVELS) {
    const groups = new Map<string, PlaceRecordInput[]>();
    for (const record of records) {
      const key = placeAtLevel(pathById.get(record.id)!, level);
      if (!key || !places.has(key)) continue;
      const group = groups.get(key) ?? [];
      group.push(record);
      groups.set(key, group);
    }
    const { minZoom, maxZoom } = levelRange(level);
    for (const [key, members] of groups) {
      const place = places.get(key)!;
      const breakdown = { site: 0, area: 0, county: 0, state: 0 };
      let west = Infinity;
      let south = Infinity;
      let east = -Infinity;
      let north = -Infinity;
      for (const member of members) {
        breakdown[precisionBandFor(member.precision)] += 1;
        west = Math.min(west, member.lng);
        east = Math.max(east, member.lng);
        south = Math.min(south, member.lat);
        north = Math.max(north, member.lat);
      }
      tokens.push({
        id: `${level}:${key}`,
        placeKey: key,
        level: place.level,
        name: place.name,
        anchor: place.anchor,
        minZoom,
        maxZoom,
        memberIds: members.map((member) => member.id),
        breakdown,
        bounds: [west, south, east, north],
      });
    }
  }

  return { tokens, sites: spreadSites(sites), places, pathById };
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}

/**
 * The precision mix as one plain sentence fragment, finest first: "180 sit at exact sites, 110 are
 * placed within a city, and 22 are known only by county".
 */
export function breakdownInWords(breakdown: PlaceBreakdown): string {
  const n = (count: number) => count.toLocaleString('en-US');
  const parts = [
    breakdown.site > 0
      ? breakdown.site === 1
        ? '1 sits at an exact site'
        : `${n(breakdown.site)} sit at exact sites`
      : '',
    breakdown.area > 0
      ? `${n(breakdown.area)} ${breakdown.area === 1 ? 'is' : 'are'} placed within a city`
      : '',
    breakdown.county > 0
      ? `${n(breakdown.county)} ${breakdown.county === 1 ? 'is' : 'are'} known only by county`
      : '',
    breakdown.state > 0
      ? `${n(breakdown.state)} ${breakdown.state === 1 ? 'is' : 'are'} known only by state`
      : '',
  ].filter(Boolean);
  if (parts.length < 3) return parts.join(' and ');
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
}

/** The full token sentence a screen reader and the list header read. */
export function placeSummary(name: string, breakdown: PlaceBreakdown): string {
  const total = breakdown.site + breakdown.area + breakdown.county + breakdown.state;
  return `${name}, ${plural(total, 'record', 'records')}. Of these, ${breakdownInWords(breakdown)}.`;
}

/** The `?place=` value shape: a level prefix and a slug. */
export const PLACE_KEY_PATTERN = /^(state|county|city)-[a-z0-9-]{1,80}$/;
