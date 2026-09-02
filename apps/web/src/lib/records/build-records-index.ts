/**
 * `/records` — the archive read as a list, not a map (SP-09, repo-92n2.9).
 *
 * This module is the whole surface's logic: filtering, faceting, paging and href construction.
 * It is pure and synchronous so the page can be a plain server component and every test runs
 * without a database.
 *
 * WHY IT DOES NOT BUILD ON `ExploreMapFeature`. The obvious shortcut is to reuse the Atlas's
 * feature collection, which already carries kind family, era buckets, place and confidence. It is
 * the wrong source: `buildExploreMapSource` only emits a feature for an entity it can resolve a
 * public geo anchor for, so an index built from it would silently omit every record without
 * coordinates — and "what is documented about X, including the things we cannot place" is the
 * exact question this room exists to answer (design-direction-v9-surfaces.md §4.2, and the
 * epic's first binding correction). So rows are built from a catalog that keeps ungeocoded
 * records: full `PublicEntityView` today, or the search_index slim when `confidenceTier` is
 * projected on active-release docs.
 *
 * The filter VOCABULARY, though, must not drift from the Lens. Every label and bucket here is
 * derived by calling the same shared modules the Atlas calls — `kindFamilyFor`,
 * `kindFamilyEncodingFor`, `resolveEntityEraBuckets`, `highestConfidence`, `getTopicLabel` — never
 * by a local copy of the list. `build-records-index.test.ts` asserts that on drift.
 */
import { getTopicLabel, isValidTopicId } from '@repo/domain/taxonomy/topics';
import {
  findUsStateByPostalCode,
  findUsStateFromJurisdictionLabel,
} from '@repo/domain/map/geography';
import type { PublicSearchIndexDoc } from '@repo/domain/search';
import type { PublicEntityView } from '../../data/public-seed';
import { highestConfidence, type ConfidenceTier } from '../map-experience/build-explore-map-source';
import { resolveEntityEraBuckets } from '../map-experience/entity-era-facts';
import { geoAnchorFor } from '../map-experience/entity-geo';
import { mapListContinuityLabel } from '../discovery/continuity-label';
import { canStandHere, staysOffPublicMap } from '../place/public-place-path';
import { placeHrefForEntity, placeSlugCollisionCounts } from '../place/place-slug';
import {
  EVIDENCE_FLOORS,
  floorLabel,
  gradeDescription,
  gradeForConfidence,
  meetsEvidenceFloor,
  type EvidenceFloor,
  type EvidenceGrade,
} from '../map-experience/evidence-grade';
import {
  isKnownMapKindFamily,
  kindFamilyEncodingFor,
  kindFamilyFor,
  resolveMapTone,
  type MapKindFamily,
} from '../map-experience/kind-encoding';

/** Arrival query Place pages understand (`from=list` + shared DiscoveryState keys). */
function recordsArrivalQuery(query: RecordsQuery): string {
  const params = new URLSearchParams();
  params.set('from', 'list');
  if (query.q.length > 0) params.set('q', query.q);
  if (query.kind.length > 0) params.set('kind', query.kind);
  if (query.era.length > 0) params.set('era', query.era);
  if (query.state.length > 0) params.set('state', query.state);
  if (query.topic.length > 0) params.set('topic', query.topic);
  if (query.status.length > 0) params.set('status', query.status);
  if (query.evidence.length > 0) params.set('evidence', query.evidence);
  // Bare from=list is enough to mark the handoff; keep it even when unnarrowed.
  return params.toString();
}

function withArrivalQuery(href: string, query: string): string {
  if (query.length === 0) return href;
  return href.includes('?') ? `${href}&${query}` : `${href}?${query}`;
}

/** 100 per page, stated in the design law. Page two is its own URL, never client state. */
export const RECORDS_PAGE_SIZE = 100;

/**
 * The query vocabulary. These names are the contract `/search` and `/history` redirect into
 * (`mapSearchQueryToRecordsHref`, `mapHistoryQueryToRecordsHref`), so renaming one breaks a
 * previously public URL.
 */
export type RecordsQuery = {
  readonly q: string;
  readonly kind: string;
  readonly era: string;
  readonly state: string;
  readonly topic: string;
  readonly status: string;
  readonly evidence: string;
  readonly page: number;
};

export const EMPTY_RECORDS_QUERY: RecordsQuery = Object.freeze({
  q: '',
  kind: '',
  era: '',
  state: '',
  topic: '',
  status: '',
  evidence: '',
  page: 1,
});

/** The filter keys, in the order the chip bar renders them. `q` and `page` are not chips. */
export const RECORDS_FILTER_KEYS = Object.freeze([
  'kind',
  'era',
  'state',
  'topic',
  'status',
  'evidence',
] as const);

export type RecordsFilterKey = (typeof RECORDS_FILTER_KEYS)[number];

export type RecordsRow = {
  readonly id: string;
  readonly href: string;
  readonly name: string;
  /** City/campus label, or the jurisdiction when the record has no finer place. */
  readonly place: string;
  readonly era: string;
  readonly kindFamily: MapKindFamily;
  /** Raw kind and tone, so the row can draw the same `KindGlyph` the Atlas results rail draws. */
  readonly kind: string;
  readonly mapTone: string | undefined;
  /** `null` is an honest ungraded record, never silently promoted to C. */
  readonly grade: EvidenceGrade | null;
  readonly gradeDescription: string;
};

export type RecordsFacet = {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly href: string;
};

export type RecordsGroup = {
  readonly label: string;
  readonly count: number;
  readonly href: string;
};

/** One active constraint, with the words that say why the set is narrowed. */
export type RecordsConstraint = {
  readonly key: RecordsFilterKey | 'q';
  readonly label: string;
  readonly clearHref: string;
};

export type RecordsIndex = {
  readonly query: RecordsQuery;
  readonly rows: readonly RecordsRow[];
  readonly totalMatched: number;
  readonly totalAll: number;
  readonly page: number;
  readonly pageCount: number;
  readonly countLabel: string;
  readonly canonicalPath: string;
  readonly previousHref: string | undefined;
  readonly nextHref: string | undefined;
  readonly facets: Readonly<Record<RecordsFilterKey, readonly RecordsFacet[]>>;
  readonly eraGroups: readonly RecordsGroup[];
  readonly stateGroups: readonly RecordsGroup[];
  readonly constraints: readonly RecordsConstraint[];
  readonly clearAllHref: string;
  /** Hands the current narrowing to the Atlas, with the reason string the off-ramp reads out. */
  readonly atlasHref: string;
  readonly atlasReason: string;
  /** Matched records that carry a public map anchor (honest Atlas continuity). */
  readonly mappableMatched: number;
};

function humanize(value: string): string {
  return value
    .split(/[_-]/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalizes raw search params. Anything unrecognised collapses to the empty string rather than
 * throwing, because this route is reachable from bookmarks and from three redirect families, and
 * a stale param must narrow nothing rather than 500.
 */
export function parseRecordsQuery(
  raw: Record<string, string | readonly string[] | undefined>,
): RecordsQuery {
  const one = (key: string): string => {
    const value = raw[key];
    const first = Array.isArray(value) ? value[0] : value;
    return typeof first === 'string' ? first.trim() : '';
  };
  const rawPage = Number.parseInt(one('page'), 10);
  return {
    q: one('q').slice(0, 120),
    kind: one('kind').toLowerCase(),
    era: one('era').toLowerCase(),
    state: one('state').toUpperCase(),
    topic: one('topic').toLowerCase(),
    status: one('status').toLowerCase(),
    // The floor vocabulary is upper-case letters ('A' | 'B' | 'C'), unlike every other filter.
    evidence: one('evidence').toUpperCase(),
    page: Number.isFinite(rawPage) && rawPage > 1 ? rawPage : 1,
  };
}

/**
 * Builds a `/records` href. Params are emitted in a fixed order so a given narrowing has exactly
 * one URL, which is what makes the self-referential canonical honest.
 */
export function recordsHref(query: Partial<RecordsQuery>): string {
  const merged = { ...EMPTY_RECORDS_QUERY, ...query };
  const params = new URLSearchParams();
  if (merged.q.length > 0) params.set('q', merged.q);
  for (const key of RECORDS_FILTER_KEYS) {
    if (merged[key].length > 0) params.set(key, merged[key]);
  }
  // `page=1` is never emitted: `/records` and `/records?page=1` would otherwise be two URLs for
  // one page, and each would claim to be canonical.
  if (merged.page > 1) params.set('page', String(merged.page));
  const search = params.toString();
  return search.length > 0 ? `/records?${search}` : '/records';
}

type RecordFacts = {
  readonly row: RecordsRow;
  readonly eraBuckets: readonly string[];
  readonly topicIds: readonly string[];
  readonly confidenceTier: ConfidenceTier;
  readonly statePostal: string | undefined;
  readonly stateName: string | undefined;
  readonly status: string;
  readonly haystack: string;
  readonly mappable: boolean;
};

/**
 * Minimal catalog row for Records. Full entities and search_index docs both adapt into this.
 * Keeps ungeocoded records (unlike ExploreMapFeature).
 */
export type RecordsCatalogEntry = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: string;
  readonly summary: string;
  readonly jurisdictionLabel: string;
  readonly locationLabel: string;
  readonly topicTags: readonly string[];
  readonly topicIds?: readonly string[];
  readonly eraBuckets?: readonly string[];
  readonly status?: string;
  readonly confidenceTier: ConfidenceTier;
  readonly mappable: boolean;
  readonly locationPrecision?: string;
};

/** True when search_index docs carry projected confidence (backfill or new publishes). */
export function searchIndexReadyForRecords(
  docs: readonly PublicSearchIndexDoc[],
  /** Require this share of docs to carry an explicit tier before leaving full-entity hydrate. */
  minCoverage = 0.95,
): boolean {
  if (docs.length === 0) return false;
  let withTier = 0;
  for (const doc of docs) {
    if (doc.confidenceTier !== undefined) withTier += 1;
  }
  return withTier / docs.length >= minCoverage;
}

export function recordsCatalogFromEntity(entity: PublicEntityView): RecordsCatalogEntry {
  const eraBuckets = resolveEntityEraBuckets({
    ...(entity.eraBuckets !== undefined ? { eraBuckets: entity.eraBuckets } : {}),
    ...(entity.era !== undefined ? { era: entity.era } : {}),
    ...(entity.eventWindow !== undefined ? { eventWindow: entity.eventWindow } : {}),
    ...(entity.statusHistory !== undefined ? { statusHistory: entity.statusHistory } : {}),
    claims: entity.claims,
  });
  return {
    id: entity.id,
    displayName: entity.displayName,
    kind: entity.kind,
    summary: entity.summary,
    jurisdictionLabel: entity.jurisdictionLabel,
    locationLabel: entity.locationLabel,
    topicTags: entity.topicTags,
    ...(entity.topicIds !== undefined ? { topicIds: entity.topicIds } : {}),
    eraBuckets,
    ...(entity.status !== undefined ? { status: entity.status } : {}),
    confidenceTier: highestConfidence(entity.claims),
    mappable: carriesPublicMapAnchor(entity),
    ...(entity.locationPrecision !== undefined
      ? { locationPrecision: entity.locationPrecision }
      : {}),
  };
}

export function recordsCatalogFromSearchDoc(doc: PublicSearchIndexDoc): RecordsCatalogEntry {
  const summary = doc.summary?.trim() ?? '';
  const jurisdictionLabel = doc.jurisdictionState?.trim() ?? '';
  return {
    id: doc.id,
    displayName: doc.displayName,
    kind: doc.kind,
    summary,
    jurisdictionLabel,
    locationLabel: '',
    topicTags: doc.topicTags,
    ...(doc.topicIds !== undefined ? { topicIds: doc.topicIds } : {}),
    eraBuckets: doc.eraBuckets,
    ...(doc.status !== undefined ? { status: doc.status } : {}),
    confidenceTier: doc.confidenceTier ?? 'unrated',
    mappable:
      !staysOffPublicMap({ displayName: doc.displayName }) &&
      typeof doc.geohash === 'string' &&
      doc.geohash.length > 0,
  };
}

function carriesPublicMapAnchor(entity: PublicEntityView): boolean {
  if (staysOffPublicMap(entity)) return false;
  return entity.geoAnchor !== undefined || geoAnchorFor(entity.id) !== undefined;
}

function toFacts(entry: RecordsCatalogEntry, collisions: ReadonlyMap<string, number>): RecordFacts {
  const mapTone = resolveMapTone({
    topicTags: entry.topicTags,
    ...(entry.topicIds !== undefined ? { topicIds: entry.topicIds } : {}),
    displayName: entry.displayName,
  });
  const eraBuckets = entry.eraBuckets ?? [];
  const confidenceTier = entry.confidenceTier;
  const state = findUsStateFromJurisdictionLabel(entry.jurisdictionLabel);
  const location = entry.locationLabel.trim();
  const place = location.length > 0 ? location : entry.jurisdictionLabel.trim();
  const topicSource = entry.topicIds ?? entry.topicTags;
  const standable = canStandHere({
    displayName: entry.displayName,
    kind: entry.kind,
    summary: entry.summary.length > 0 ? entry.summary : entry.displayName,
    ...(entry.locationPrecision !== undefined
      ? { locationPrecision: entry.locationPrecision }
      : {}),
  });
  const href = standable
    ? placeHrefForEntity({ id: entry.id, displayName: entry.displayName }, collisions)
    : `/entity/${entry.id}`;

  return {
    row: {
      id: entry.id,
      href,
      name: entry.displayName,
      // An honest blank, not an invented place: some records genuinely have no located anchor,
      // and that is the population this index exists to keep visible.
      place: place.length > 0 ? place : 'Place not recorded',
      era: eraBuckets[0] ?? 'Undated',
      kindFamily: kindFamilyFor(entry.kind),
      kind: entry.kind,
      mapTone,
      grade: gradeForConfidence(confidenceTier),
      gradeDescription: gradeDescription(gradeForConfidence(confidenceTier)),
    },
    eraBuckets,
    topicIds: topicSource.filter(isValidTopicId),
    confidenceTier,
    statePostal: state === undefined ? undefined : state.postalCode,
    stateName: state === undefined ? undefined : state.name,
    status: entry.status ?? '',
    haystack: `${entry.displayName} ${entry.summary} ${place}`.toLowerCase(),
    mappable: entry.mappable,
  };
}

function isRecordsCatalogEntry(value: unknown): value is RecordsCatalogEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'confidenceTier' in value &&
    'mappable' in value &&
    'jurisdictionLabel' in value &&
    'locationLabel' in value
  );
}

function isSearchIndexDoc(value: unknown): value is PublicSearchIndexDoc {
  return (
    typeof value === 'object' &&
    value !== null &&
    'releaseId' in value &&
    'nameLower' in value &&
    'claimCount' in value
  );
}

function toRecordsCatalog(
  catalog:
    readonly PublicEntityView[] | readonly PublicSearchIndexDoc[] | readonly RecordsCatalogEntry[],
): readonly RecordsCatalogEntry[] {
  if (catalog.length === 0) return [];
  const first = catalog[0];
  if (isRecordsCatalogEntry(first)) {
    return catalog as readonly RecordsCatalogEntry[];
  }
  if (isSearchIndexDoc(first)) {
    return (catalog as readonly PublicSearchIndexDoc[]).map(recordsCatalogFromSearchDoc);
  }
  return (catalog as readonly PublicEntityView[]).map(recordsCatalogFromEntity);
}

function matchesExcept(
  facts: RecordFacts,
  query: RecordsQuery,
  skip: RecordsFilterKey | 'none',
): boolean {
  if (query.q.length > 0 && !facts.haystack.includes(query.q.toLowerCase())) return false;
  if (skip !== 'kind' && query.kind.length > 0 && facts.row.kindFamily !== query.kind) return false;
  if (skip !== 'era' && query.era.length > 0 && !facts.eraBuckets.includes(query.era)) return false;
  if (skip !== 'state' && query.state.length > 0 && facts.statePostal !== query.state) return false;
  if (skip !== 'topic' && query.topic.length > 0 && !facts.topicIds.includes(query.topic))
    return false;
  if (skip !== 'status' && query.status.length > 0 && facts.status !== query.status) return false;
  // A floor, not an equality match. Routing "B and up" through an exact match would drop every
  // grade A record — the opposite of what the reader asked for (see `applyEvidenceFloor`).
  if (
    skip !== 'evidence' &&
    query.evidence.length > 0 &&
    !meetsEvidenceFloor(facts.confidenceTier, query.evidence as EvidenceFloor)
  )
    return false;
  return true;
}

/** Values a facet key takes on one record, so counting is one shared loop. */
function valuesFor(facts: RecordFacts, key: RecordsFilterKey): readonly string[] {
  switch (key) {
    case 'kind':
      return [facts.row.kindFamily];
    case 'era':
      return facts.eraBuckets;
    case 'state':
      return facts.statePostal === undefined ? [] : [facts.statePostal];
    case 'topic':
      return facts.topicIds;
    case 'status':
      return facts.status.length > 0 ? [facts.status] : [];
    case 'evidence':
      // A record counts toward every floor it clears, which is what makes the chip counts read
      // as "how many would I still have" rather than "how many are exactly this grade".
      return EVIDENCE_FLOORS.filter(
        (floor) => floor !== 'any' && meetsEvidenceFloor(facts.confidenceTier, floor),
      );
  }
}

function labelFor(key: RecordsFilterKey, value: string, stateNames: Map<string, string>): string {
  switch (key) {
    case 'kind':
      return isKnownMapKindFamily(value) ? kindFamilyEncodingFor(value).label : humanize(value);
    case 'era':
      return value;
    case 'state':
      return stateNames.get(value) ?? value;
    case 'topic':
      return getTopicLabel(value) ?? humanize(value);
    case 'status':
      return humanize(value);
    case 'evidence':
      return floorLabel(value as EvidenceFloor);
  }
}

function compareGroups(a: RecordsGroup, b: RecordsGroup): number {
  return b.count - a.count || a.label.localeCompare(b.label);
}

/**
 * Builds everything `/records` renders for one request.
 *
 * Facet counts are computed with that facet's own constraint lifted, which is what makes the
 * chip bar usable: with `kind=people` active, the Places chip still shows how many records you
 * would get by switching to it, rather than zero.
 *
 * Accepts either full entities (tests + pre-backfill fallback) or slim search_index docs.
 */
export function buildRecordsIndex(
  catalog:
    readonly PublicEntityView[] | readonly PublicSearchIndexDoc[] | readonly RecordsCatalogEntry[],
  query: RecordsQuery,
): RecordsIndex {
  const entries = toRecordsCatalog(catalog);
  const collisions = placeSlugCollisionCounts(entries);
  const facts = entries.map((entry) => toFacts(entry, collisions));
  const stateNames = new Map<string, string>();
  for (const record of facts) {
    if (record.statePostal !== undefined && record.stateName !== undefined) {
      stateNames.set(record.statePostal, record.stateName);
    }
  }

  const matched = facts.filter((record) => matchesExcept(record, query, 'none'));
  const mappableMatched = matched.filter((record) => record.mappable).length;

  const facets = Object.fromEntries(
    RECORDS_FILTER_KEYS.map((key) => {
      const counts = new Map<string, number>();
      for (const record of facts) {
        if (!matchesExcept(record, query, key)) continue;
        for (const value of valuesFor(record, key)) {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
      }
      const active = query[key];
      const options: RecordsFacet[] = [...counts.entries()]
        .map(([value, count]) => ({
          id: value,
          label: labelFor(key, value, stateNames),
          count,
          // Selecting a filter returns to page one: page 4 of the old set is not page 4 of the
          // new one, and a reader who lands on an empty page reads it as an empty archive.
          href: recordsHref({ ...query, [key]: active === value ? '' : value, page: 1 }),
        }))
        .sort((a, b) => {
          // A floor is an ordered scale, so it reads in scale order. Sorting it by count puts
          // "A only" between "B and up" and "C and up", which reads as three unrelated chips.
          if (key === 'evidence') {
            return (
              EVIDENCE_FLOORS.indexOf(a.id as EvidenceFloor) -
              EVIDENCE_FLOORS.indexOf(b.id as EvidenceFloor)
            );
          }
          // The active option is pinned first. Sorted purely by count, a narrow constraint like
          // `state=OK` falls outside the chips the room shows, so the one chip that would clear
          // it is the one chip the reader cannot see.
          if (a.id === active) return -1;
          if (b.id === active) return 1;
          return b.count - a.count || a.label.localeCompare(b.label);
        });
      return [key, Object.freeze(options)];
    }),
  ) as Record<RecordsFilterKey, readonly RecordsFacet[]>;

  const pageCount = Math.max(1, Math.ceil(matched.length / RECORDS_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * RECORDS_PAGE_SIZE;
  const discoveryQuery = recordsArrivalQuery(query);
  const rows = matched.slice(start, start + RECORDS_PAGE_SIZE).map((record) => ({
    ...record.row,
    href: withArrivalQuery(record.row.href, discoveryQuery),
  }));

  const constraints: RecordsConstraint[] = [];
  if (query.q.length > 0) {
    constraints.push({
      key: 'q',
      label: `Matching “${query.q}”`,
      clearHref: recordsHref({ ...query, q: '', page: 1 }),
    });
  }
  for (const key of RECORDS_FILTER_KEYS) {
    const value = query[key];
    if (value.length === 0) continue;
    constraints.push({
      key,
      label: labelFor(key, value, stateNames),
      clearHref: recordsHref({ ...query, [key]: '', page: 1 }),
    });
  }

  const groupBy = (key: 'era' | 'state'): readonly RecordsGroup[] =>
    [
      ...matched
        .reduce((counts, record) => {
          for (const value of valuesFor(record, key)) {
            counts.set(value, (counts.get(value) ?? 0) + 1);
          }
          return counts;
        }, new Map<string, number>())
        .entries(),
    ]
      .map(([value, count]) => ({
        label: labelFor(key, value, stateNames),
        count,
        href: recordsHref({ ...query, [key]: value, page: 1 }),
      }))
      .sort(compareGroups);

  return {
    query: { ...query, page },
    rows,
    totalMatched: matched.length,
    totalAll: facts.length,
    page,
    pageCount,
    countLabel:
      matched.length === facts.length
        ? `${facts.length.toLocaleString('en-US')} records`
        : `${matched.length.toLocaleString('en-US')} of ${facts.length.toLocaleString('en-US')} records`,
    canonicalPath: recordsHref({ ...query, page }),
    previousHref: page > 1 ? recordsHref({ ...query, page: page - 1 }) : undefined,
    nextHref: page < pageCount ? recordsHref({ ...query, page: page + 1 }) : undefined,
    facets,
    eraGroups: groupBy('era'),
    stateGroups: groupBy('state'),
    constraints,
    clearAllHref: '/records',
    atlasHref: buildAtlasHref(query),
    atlasReason: mapListContinuityLabel(matched.length, mappableMatched),
    mappableMatched,
  };
}

export type RecordsNeighborLink = {
  readonly id: string;
  readonly name: string;
  readonly href: string;
};

export type RecordsNeighbors = {
  readonly previous?: RecordsNeighborLink;
  readonly next?: RecordsNeighborLink;
  readonly index: number;
  readonly total: number;
};

/**
 * Prev/next within the Records narrowing (same order as the list), for Place discovery stepping.
 * Does not build facets — filter + adjacency only.
 */
export function findRecordsNeighbors(
  catalog:
    readonly PublicEntityView[] | readonly PublicSearchIndexDoc[] | readonly RecordsCatalogEntry[],
  query: RecordsQuery,
  entityId: string,
  arrivalQuery = '',
): RecordsNeighbors | undefined {
  const entries = toRecordsCatalog(catalog);
  const collisions = placeSlugCollisionCounts(entries);
  const matched = entries
    .map((entry) => toFacts(entry, collisions))
    .filter((record) => matchesExcept(record, query, 'none'));
  const index = matched.findIndex((record) => record.row.id === entityId);
  if (index < 0 || matched.length === 0) return undefined;

  const linkAt = (at: number): RecordsNeighborLink | undefined => {
    const row = matched[at]?.row;
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      href: withArrivalQuery(row.href, arrivalQuery),
    };
  };

  const previous = index > 0 ? linkAt(index - 1) : undefined;
  const next = index < matched.length - 1 ? linkAt(index + 1) : undefined;

  return {
    ...(previous !== undefined ? { previous } : {}),
    ...(next !== undefined ? { next } : {}),
    index,
    total: matched.length,
  };
}

/**
 * Hands the current narrowing to the Atlas. Every key must stay inside
 * `EXPLORE_URL_PARAM_KEYS` / the edge allowlist — a param this function invents is stripped by
 * middleware before the Atlas ever sees it, silently widening the set.
 *
 * One constraint does NOT cross, and the off-ramp copy says so rather than pretending: `q`,
 * because the Atlas has no text pin filter.
 *
 * `topic` becomes `theme` (Lens name for the same controlled topic id).
 * `evidence` becomes `floor` (and-up grade predicate; not exact-match `confidence`).
 */
export function buildAtlasHref(query: RecordsQuery): string {
  const params = new URLSearchParams();
  if (query.kind.length > 0) params.set('kind', query.kind);
  if (query.era.length > 0) params.set('era', query.era);
  if (query.state.length > 0) params.set('state', query.state);
  if (query.topic.length > 0) params.set('theme', query.topic);
  if (query.status.length > 0) params.set('status', query.status);
  if (query.evidence.length > 0) params.set('floor', query.evidence);
  const search = params.toString();
  return search.length > 0 ? `/explore?${search}` : '/explore';
}

/** Exported for the drift test: the postal codes this index can actually filter on. */
export function knownStatePostalCode(code: string): boolean {
  return findUsStateByPostalCode(code) !== undefined;
}
