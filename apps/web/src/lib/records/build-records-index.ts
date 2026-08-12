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
 * epic's first binding correction). So rows are built from `PublicEntityView` directly.
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
import type { PublicEntityView } from '../../data/public-seed';
import { highestConfidence, type ConfidenceTier } from '../map-experience/build-explore-map-source';
import { resolveEntityEraBuckets } from '../map-experience/entity-era-facts';
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
};

function toFacts(entity: PublicEntityView): RecordFacts {
  const mapTone = resolveMapTone({
    topicTags: entity.topicTags,
    ...(entity.topicIds !== undefined ? { topicIds: entity.topicIds } : {}),
    displayName: entity.displayName,
  });
  const eraBuckets = resolveEntityEraBuckets({
    ...(entity.eraBuckets !== undefined ? { eraBuckets: entity.eraBuckets } : {}),
    ...(entity.era !== undefined ? { era: entity.era } : {}),
    ...(entity.eventWindow !== undefined ? { eventWindow: entity.eventWindow } : {}),
    ...(entity.statusHistory !== undefined ? { statusHistory: entity.statusHistory } : {}),
    claims: entity.claims,
  });
  const confidenceTier = highestConfidence(entity.claims);
  const state = findUsStateFromJurisdictionLabel(entity.jurisdictionLabel);
  const location = entity.locationLabel.trim();
  const place = location.length > 0 ? location : entity.jurisdictionLabel.trim();
  const topicSource = entity.topicIds ?? entity.topicTags;

  return {
    row: {
      id: entity.id,
      href: `/entity/${entity.id}`,
      name: entity.displayName,
      // An honest blank, not an invented place: some records genuinely have no located anchor,
      // and that is the population this index exists to keep visible.
      place: place.length > 0 ? place : 'Place not recorded',
      era: eraBuckets[0] ?? 'Undated',
      kindFamily: kindFamilyFor(entity.kind),
      kind: entity.kind,
      mapTone,
      grade: gradeForConfidence(confidenceTier),
      gradeDescription: gradeDescription(gradeForConfidence(confidenceTier)),
    },
    eraBuckets,
    topicIds: topicSource.filter(isValidTopicId),
    confidenceTier,
    statePostal: state === undefined ? undefined : state.postalCode,
    stateName: state === undefined ? undefined : state.name,
    status: entity.status ?? '',
    haystack: `${entity.displayName} ${entity.summary} ${place}`.toLowerCase(),
  };
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
 */
export function buildRecordsIndex(
  entities: readonly PublicEntityView[],
  query: RecordsQuery,
): RecordsIndex {
  const facts = entities.map(toFacts);
  const stateNames = new Map<string, string>();
  for (const record of facts) {
    if (record.statePostal !== undefined && record.stateName !== undefined) {
      stateNames.set(record.statePostal, record.stateName);
    }
  }

  const matched = facts.filter((record) => matchesExcept(record, query, 'none'));

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
  const rows = matched.slice(start, start + RECORDS_PAGE_SIZE).map((record) => record.row);

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

  const constraintWords =
    constraints.length === 0
      ? 'every record in the release'
      : constraints.map((constraint) => constraint.label).join(', ');

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
    atlasReason: `Showing ${constraintWords} that carry a place.`,
  };
}

/**
 * Hands the current narrowing to the Atlas. Every key is checked against `EXPLORE_URL_PARAM_KEYS`
 * by `query-normalization`, so a param this function invents is stripped by middleware before the
 * Atlas ever sees it — silently widening the set the reader thought they were carrying over.
 *
 * One constraint does NOT cross, and the off-ramp copy says so rather than pretending: `q`,
 * because the Atlas has no text constraint at all.
 *
 * `topic` becomes `theme`, which is the Lens's name for the same controlled topic id.
 *
 * `evidence` becomes `floor`. SP-16 (repo-92n2.16) landed the evidence floor on the Lens as its
 * own predicate, separate from the Lens's pre-existing exact-match `confidence` tier — routing a
 * floor through `confidence` would map "B and up" onto `confidence=medium` and drop every grade A
 * record, the opposite of what the reader asked for (see `evidence-grade.ts`'s
 * `applyEvidenceFloor`). `floor` carries the same `EvidenceFloor` vocabulary this module already
 * uses (`'C' | 'B' | 'A'`), unencoded, so `?floor=B` and "B and up" here name the same set.
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
  return search.length > 0 ? `/?${search}` : '/';
}

/** Exported for the drift test: the postal codes this index can actually filter on. */
export function knownStatePostalCode(code: string): boolean {
  return findUsStateByPostalCode(code) !== undefined;
}
