/**
 * Pure helpers for gated incremental upsert into bb_public.release_entities (+ search_index).
 * Used by publish-release-entities-incremental.ts and unit tests — no database I/O.
 */
import {
  buildReleaseEntityArtifacts,
  deriveCatalogEntityStatus,
  findUsStateByPostalCode,
  findUsStateForPoint,
  findUsStateFromJurisdictionLabel,
  normalizeReleaseClaims,
  normalizeReleaseRelated,
  normalizePublicPrecision,
  type CanonicalStatusSnapshot,
  type PublicVisit,
  type ReleaseEntityProjectionFields,
  type ReleaseLocationOverride,
  type ReleaseSearchIndexFields,
  type ReleaseSourceClaim,
  type ReleaseSourceEntity,
  type StatusHistoryEntry,
  type EntityStatusValue,
  findTemplateSummarySignature,
} from '@repo/domain';
import { SUMMARY_MIN_CHARS, SUMMARY_MAX_CHARS } from './entity-enrichment-llm.ts';
import { computeClaimConfidence, confidenceLevelForSource } from '../lib/confidence.ts';
import { lintPublishStatus, type PublishStatusLintReport } from './publish-status-linter.ts';
import { searchTopicsFromProjection } from './projection-divergence.ts';
import { cityStateFromJurisdictionLabel } from './evidence-collectors/subject-identity.ts';
import { buildNrhpListingFactObject, buildNrhpSignificanceObject } from './nrhp-area-labels.ts';

export const INCREMENTAL_PUBLISH_CONFIDENCE_FLOOR = 0.75;

/**
 * Ceiling on one claim's merged quotations from a single document.
 *
 * A claim's object is shown to a reader as the sentence the record rests on. Several passages
 * from one document can be worth showing; a dozen is a wall of text, not evidence. Passages past
 * this length are dropped, which is what happened to every repeat passage before merging existed.
 */
export const MERGED_EVIDENCE_QUOTE_MAX_CHARS = 600;

export type LandscapePublishRow = {
  readonly id: string;
  readonly lane: string;
  readonly kind: string;
  readonly display_name: string;
  readonly summary: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly canonical_url: string | null;
  readonly source_item_id: string;
  readonly provenance: Readonly<Record<string, unknown>>;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly exact_in_release?: boolean;
  readonly name_overlap?: boolean;
};

export type PublishGateSkipReason =
  | 'person_kind'
  | 'people_category'
  | 'greenbook_lane'
  | 'missing_location'
  | 'already_in_public'
  | 'name_overlap'
  | 'missing_canonical_url'
  | 'summary_too_short'
  | 'template_only'
  | 'build_failed'
  | 'confidence_below_floor'
  /** A republish would publish fewer claims than the record already carries (repo-cjlkp). */
  | 'claim_count_regression';

export type PublishGateResult =
  | {
      readonly eligible: true;
      readonly entry: ReleaseSourceEntity;
      readonly confidence: number;
      /**
       * Set only when this candidate inherited an already-live record's location (repo-lai8y).
       * The caller MUST forward it to `buildArtifactsForEntry`: the gate's own build is a probe,
       * and the row it writes is built a second time by the caller. `matchMethod` exists nowhere
       * on `ReleaseSourceEntity`, so an override dropped here republishes the point as
       * `manual_research` regardless of how it was actually matched.
       */
      readonly locationOverride?: ReleaseLocationOverride;
    }
  | { readonly eligible: false; readonly reason: PublishGateSkipReason; readonly detail: string };

export type ReleaseEntityUpsertRow = {
  readonly release_id: string;
  readonly entity_id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly summary: string | null;
  readonly location: unknown;
  readonly geohash: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly claims: unknown;
  readonly taxonomy: unknown;
  readonly related: unknown;
  readonly projection: unknown;
};

export type CanonicalEntityPublishRow = {
  readonly entity_id: string;
  readonly living_status: string | null;
  readonly status_history: unknown;
  readonly kind_detail: unknown;
};

export type CanonicalEntityUpsertParams = {
  readonly id: string;
  readonly kind: string;
  readonly entityClass: string | null;
  readonly displayName: string;
  readonly livingStatus: string;
};

export type PublishLintSkipReason = 'status_linter_error';

export type PublishArtifactsResult =
  | {
      readonly ok: true;
      readonly entityRow: ReleaseEntityUpsertRow;
      readonly searchRow: SearchIndexUpsertRow;
      readonly lintReport: PublishStatusLintReport;
    }
  | {
      readonly ok: false;
      readonly reason: PublishLintSkipReason | 'build_failed';
      readonly detail: string;
      readonly lintReport?: PublishStatusLintReport;
    };

export type SearchIndexUpsertRow = {
  readonly id: string;
  readonly release_id: string;
  readonly entity_id: string;
  readonly name: string;
  readonly name_lower: string;
  readonly aliases: readonly string[];
  readonly topics: readonly string[];
  readonly kind: string;
  readonly status: string | null;
  readonly geohash: string | null;
  readonly related_count: number;
  readonly claim_count: number;
  readonly facets: unknown;
};

function isLivingStatus(value: string): value is 'living' | 'deceased' | 'unknown' {
  return value === 'living' || value === 'deceased' || value === 'unknown';
}

function buildContext(input: {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly canonicalStatus?: CanonicalStatusSnapshot;
  readonly visitOverride?: PublicVisit;
  readonly locationOverride?: ReleaseLocationOverride;
}) {
  return {
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
    ...(input.canonicalStatus !== undefined ? { canonicalStatus: input.canonicalStatus } : {}),
    ...(input.visitOverride !== undefined ? { visitOverride: input.visitOverride } : {}),
    ...(input.locationOverride !== undefined ? { locationOverride: input.locationOverride } : {}),
  };
}

function lintBuiltProjection(
  entry: ReleaseSourceEntity,
  projection: ReleaseEntityProjectionFields,
): PublishStatusLintReport {
  return lintPublishStatus({
    entityId: entry.id,
    kind: entry.kind,
    summary: entry.summary,
    ...(entry.historicalContext !== undefined
      ? { historicalContext: entry.historicalContext }
      : {}),
    ...(projection.status !== undefined ? { status: projection.status } : {}),
    ...(projection.livingStatus !== undefined ? { livingStatus: projection.livingStatus } : {}),
  });
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Readonly<Record<string, unknown>>;
  }
  return {};
}

function asStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asRecordArray(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .map((item) => item as Readonly<Record<string, unknown>>);
}

function parseStatusHistory(raw: unknown): readonly StatusHistoryEntry<EntityStatusValue>[] {
  if (!Array.isArray(raw)) return [];
  const parsed: StatusHistoryEntry<EntityStatusValue>[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Readonly<Record<string, unknown>>;
    if (typeof record.status !== 'string') continue;
    parsed.push({
      status: record.status as EntityStatusValue,
      datePrecision:
        typeof record.datePrecision === 'string' ? (record.datePrecision as never) : 'circa',
      basisClaimIds: Array.isArray(record.basisClaimIds)
        ? record.basisClaimIds.filter((id): id is string => typeof id === 'string')
        : [],
      ...(typeof record.validFrom === 'string' ? { validFrom: record.validFrom } : {}),
      ...(record.validTo !== undefined ? { validTo: record.validTo as string | null } : {}),
    });
  }
  return parsed;
}

export function inferEntityClassForCanonical(kind: string): string | null {
  if (kind === 'person') return 'person';
  if (kind === 'place') return 'place';
  if (kind === 'organization' || kind === 'institution' || kind === 'school') return 'organization';
  if (kind === 'event') return 'event';
  if (kind === 'law' || kind === 'case') return 'legal';
  if (kind === 'publication' || kind === 'artifact' || kind === 'invention') return 'work';
  if (kind === 'movement') return 'movement';
  return null;
}

export function parseCanonicalStatusSnapshot(
  row: CanonicalEntityPublishRow | null | undefined,
): CanonicalStatusSnapshot | undefined {
  if (!row) return undefined;
  const statusHistory = parseStatusHistory(row.status_history);
  const livingRaw = row.living_status?.trim();
  const livingStatus =
    livingRaw === 'living' ||
    livingRaw === 'deceased' ||
    livingRaw === 'unknown' ||
    livingRaw === 'not_applicable'
      ? livingRaw
      : undefined;
  if (livingStatus === undefined && statusHistory.length === 0) return undefined;
  return {
    ...(livingStatus !== undefined ? { livingStatus } : {}),
    ...(statusHistory.length > 0 ? { statusHistory } : {}),
  };
}

export function canonicalUpsertParamsFromLandscape(
  row: LandscapePublishRow,
  entityId: string,
): CanonicalEntityUpsertParams {
  const review = asRecord(row.payload.personReview);
  const reviewLivingRaw = review.livingStatus;
  const reviewLiving =
    typeof reviewLivingRaw === 'string' && isLivingStatus(reviewLivingRaw)
      ? reviewLivingRaw
      : undefined;
  const livingStatus = row.kind === 'person' ? (reviewLiving ?? 'unknown') : 'not_applicable';
  return {
    id: entityId,
    kind: row.kind,
    entityClass: inferEntityClassForCanonical(row.kind),
    displayName: row.display_name.trim(),
    livingStatus,
  };
}

/**
 * Person rows are blocked from incremental publish unless an explicit privacy review is
 * recorded on the row: payload.personReview must be an object with approved=true plus
 * approvedBy/approvedAt/basis strings.
 *
 * The gate is the recorded basis, not who typed it. `basis` has to name the evidence that the
 * subject is a deceased historical figure rather than a living private person, and `approvedBy`
 * has to name who stands behind that call. An unreviewed person row still cannot publish, and a
 * bad approval stays attributable after the fact.
 */
export function personReviewApproved(payload: Readonly<Record<string, unknown>>): boolean {
  const review = asRecord(payload.personReview);
  return (
    review.approved === true &&
    typeof review.approvedBy === 'string' &&
    review.approvedBy.length > 0 &&
    typeof review.approvedAt === 'string' &&
    review.approvedAt.length > 0 &&
    typeof review.basis === 'string' &&
    review.basis.length > 0
  );
}

export function resolveSourceCategory(row: LandscapePublishRow): string | null {
  const fromProvenance = row.provenance.sourceCategory;
  if (typeof fromProvenance === 'string' && fromProvenance.length > 0) return fromProvenance;
  const payloadProv = asRecord(row.payload.provenance).sourceCategory;
  if (typeof payloadProv === 'string' && payloadProv.length > 0) return payloadProv;
  return null;
}

function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function displayCityName(city: string): string {
  return city.replace(/\s*\(independent city\)\s*$/iu, '').trim();
}

function displayStateName(state: string): string {
  if (/^d\.?c\.?$/iu.test(state) || /district of columbia/iu.test(state)) {
    return 'District of Columbia';
  }
  const byPostal = findUsStateByPostalCode(state);
  if (byPostal) return byPostal.name;
  const byLabel = findUsStateFromJurisdictionLabel(state);
  return byLabel?.name ?? state;
}

/**
 * City + state for a landscape row. DC-sites store these on provenance
 * (`sourceCity` / `sourceState`); NRHP stores them on payload (`city` / `state`).
 */
export function placeFieldsFromLandscape(row: LandscapePublishRow): {
  readonly city: string;
  readonly state: string;
  readonly historicAddress: string;
} {
  const provenance = { ...asRecord(row.payload.provenance), ...row.provenance };
  return {
    city: readTrimmedString(provenance.sourceCity) || readTrimmedString(row.payload.city),
    state: readTrimmedString(provenance.sourceState) || readTrimmedString(row.payload.state),
    historicAddress: readTrimmedString(provenance.historicAddress),
  };
}

export function jurisdictionFromPlace(input: {
  readonly city?: string;
  readonly state?: string;
  readonly lat?: number | null;
  readonly lng?: number | null;
}): string {
  const cityRaw = input.city?.trim() ?? '';
  const stateRaw = input.state?.trim() ?? '';
  const city = cityRaw.length > 0 ? displayCityName(cityRaw) : '';
  const stateName = stateRaw.length > 0 ? displayStateName(stateRaw) : '';
  if (stateName === 'District of Columbia' && (city.length === 0 || /^washington$/iu.test(city))) {
    return 'Washington, District of Columbia';
  }
  if (city.length > 0 && stateName.length > 0) return `${city}, ${stateName}`;
  if (stateName.length > 0) return stateName;
  if (city.length > 0) return city;
  if (typeof input.lat === 'number' && typeof input.lng === 'number') {
    const fromPoint = findUsStateForPoint(input.lat, input.lng);
    if (fromPoint) return fromPoint.name;
  }
  return 'United States';
}

export function jurisdictionFromProvenance(provenance: Readonly<Record<string, unknown>>): string {
  return jurisdictionFromPlace({
    ...(readTrimmedString(provenance.sourceCity)
      ? { city: readTrimmedString(provenance.sourceCity) }
      : {}),
    ...(readTrimmedString(provenance.sourceState)
      ? { state: readTrimmedString(provenance.sourceState) }
      : {}),
  });
}

/**
 * The canonical contact/address columns a republish candidate joins against
 * (`bb_canonical.entity_visit` + the first non-empty `bb_canonical.entity_locations` row for the
 * entity, by `updated_at`), keyed by entity id by the caller.
 */
export type CanonicalVisitRow = {
  readonly phone_e164: string | null;
  readonly phone_display: string | null;
  readonly website: string | null;
  readonly hours: string | null;
  readonly visitability: string | null;
  readonly source_ids: readonly string[] | null;
  readonly street: string | null;
  readonly postal_code: string | null;
};

/**
 * "Washington, DC" -> { city: 'Washington', state: 'DC' }; anything else stays unsplit.
 *
 * Mirrors `cityStateFromJurisdiction` in sync-visit-to-projection.ts. That script parses this out
 * of an already-published projection's `jurisdictionLabel`; this republish path has no published
 * projection to read yet, so it is given the label `jurisdictionFromPlace` is about to derive for
 * the same row instead (see `visitOverrideFromCanonicalRow` below).
 *
 * The parse itself now lives in `lib/evidence-collectors/subject-identity.ts` (repo-f85hp), which
 * has no imports of its own and so can hold it for both the publisher and the evidence sweep
 * without dragging this file's dependencies along.
 */
/**
 * E.164 from whatever the source stored. Mirrors `phoneFromRow` in sync-visit-to-projection.ts:
 * Wikidata P1329 values arrive as display strings such as "+1-212-491-2200"; anything without a
 * leading + is left out rather than guessed.
 */
function phoneFromCanonicalVisitRow(row: CanonicalVisitRow): {
  readonly phone?: { readonly e164: string; readonly display: string };
} {
  const display = row.phone_display?.trim();
  if (!display) return {};
  const e164 =
    row.phone_e164?.trim() || (display.startsWith('+') ? display.replace(/[^\d+]/g, '') : '');
  if (!/^\+\d{8,15}$/.test(e164)) return {};
  return { phone: { e164, display } };
}

/**
 * Raw (pre-gating) `PublicVisit` for a republish candidate, composed from canonical
 * `entity_visit` + `entity_locations.street`/`postal_code`.
 *
 * Before this, the republish path built `ReleaseSourceEntity` from
 * `bb_research.landscape_candidates` alone, which carries no visit data at all — `entry.visit`
 * was always undefined, so a whole-object rebuild on `--republish` silently dropped the
 * phone/website/hours/street a backfill had written straight onto the published projection (the
 * only path that had ever populated it, sync-visit-to-projection.ts). This function is the
 * republish path's equivalent of that script's `rawVisitFromRow`, given as
 * `ReleaseBuildContext.visitOverride` (release-builder.ts), which wins over `entry.visit` and is
 * gated through `publicVisitForTier` before it reaches the projection exactly as before.
 *
 * City/state come from `jurisdictionFromPlace(placeFieldsFromLandscape(row))` — the same
 * derivation `buildReleaseSourceFromLandscape` uses for `entry.jurisdictionLabel` — rather than
 * from a published projection, since a republish candidate may not have one yet.
 */
export function visitOverrideFromCanonicalRow(
  row: LandscapePublishRow,
  canonicalVisit: CanonicalVisitRow,
): PublicVisit | undefined {
  const jurisdictionLabel = jurisdictionFromPlace({
    ...placeFieldsFromLandscape(row),
    lat: row.lat,
    lng: row.lng,
  });
  const address = {
    ...(canonicalVisit.street ? { street: canonicalVisit.street } : {}),
    ...cityStateFromJurisdictionLabel(jurisdictionLabel),
    ...(canonicalVisit.postal_code ? { postalCode: canonicalVisit.postal_code } : {}),
  };
  const hasAddress = Boolean(canonicalVisit.street || canonicalVisit.postal_code);
  const visit: PublicVisit = {
    ...(hasAddress ? { address } : {}),
    ...phoneFromCanonicalVisitRow(canonicalVisit),
    ...(canonicalVisit.website ? { website: canonicalVisit.website } : {}),
    ...(canonicalVisit.hours ? { hours: canonicalVisit.hours } : {}),
    ...(canonicalVisit.visitability &&
    ['open_to_public', 'exterior_only', 'private', 'demolished', 'unknown'].includes(
      canonicalVisit.visitability,
    )
      ? { visitability: canonicalVisit.visitability as NonNullable<PublicVisit['visitability']> }
      : {}),
    ...(canonicalVisit.source_ids && canonicalVisit.source_ids.length > 0
      ? { sources: canonicalVisit.source_ids }
      : {}),
  };
  return Object.keys(visit).length > 0 ? visit : undefined;
}

/**
 * Kinds where the record IS the location, so its own name is a legitimate location label.
 *
 * For everything else a display name is never a location. Falling back to it published
 * `locationLabel: "Process of Manufacturing Carbons"` on an invention, which the Where tile then
 * printed as though the process were a town. Measured against the active release on 2026-09-09,
 * 2,763 of 4,187 records carried their own name as their location label; 2,650 of those are
 * place-like kinds, where it is defensible, and the remaining 113 are not.
 *
 * The place-like set is preserved deliberately rather than fixed in the same pass: changing it
 * would rewrite 2,650 published labels for a question — what a place's location label should say
 * when it has no street address — that this change is not the place to answer.
 *
 * This never returns empty. `assertPublishableGeo` in the release builder rejects an entity whose
 * `locationLabel` is blank, so emptying the field here would not clean a label up, it would
 * unpublish the record. The display name stays as the last resort for exactly that reason.
 */
const LOCATION_IS_SELF_KINDS: ReadonlySet<string> = new Set(['place', 'school', 'institution']);

export function locationLabelFromProvenance(
  displayName: string,
  provenance: Readonly<Record<string, unknown>>,
  kind?: string,
): string {
  const historicAddress = readTrimmedString(provenance.historicAddress);
  const city = readTrimmedString(provenance.sourceCity);
  const state = readTrimmedString(provenance.sourceState);
  if (historicAddress.length > 0) {
    const suffix = [city, state].filter((part) => part.length > 0).join(', ');
    return suffix.length > 0 ? `${historicAddress}, ${suffix}` : historicAddress;
  }
  if (kind !== undefined && !LOCATION_IS_SELF_KINDS.has(kind)) {
    // A work site, an employer's city, a person's base. Every invention in the cohort carries
    // sourceCity/sourceState, so this is what they get instead of their own title.
    const cityState = [city, state].filter((part) => part.length > 0).join(', ');
    if (cityState.length > 0) return cityState;
  }
  return displayName;
}

function readPayloadConfidence(payload: Readonly<Record<string, unknown>>): number | null {
  const enrichment = asRecord(payload.enrichment);
  const fromEnrichment = enrichment.confidence;
  if (typeof fromEnrichment === 'number' && Number.isFinite(fromEnrichment)) return fromEnrichment;
  const fromRoot = payload.confidence;
  if (typeof fromRoot === 'number' && Number.isFinite(fromRoot)) return fromRoot;
  return null;
}

const DC_SOURCE_PROGRAM_CATALOG_URL =
  'https://catalog.data.gov/dataset/black-history-sites-washington';

function corroboratingSourcesForLandscape(row: LandscapePublishRow): readonly string[] {
  const urls = new Set<string>();
  const provenance = { ...asRecord(row.payload.provenance), ...row.provenance };
  const sourceUrl = provenance.sourceUrl;
  if (typeof sourceUrl === 'string' && sourceUrl.startsWith('https://')) urls.add(sourceUrl);
  if (row.lane === 'dc-sites') urls.add(DC_SOURCE_PROGRAM_CATALOG_URL);
  // repo-fbjr: the documents the evidence sweep read corroborate this record's claims, so they
  // belong in the corroboration set the confidence engine scores against.
  //
  // Without this, enrichment made a record LESS publishable. `minClaimConfidence` scores each
  // claim by its citation host and takes the minimum, so attaching a Wikipedia article — real
  // corroborating research — introduced a lower-scoring claim and dropped 13 of the first 21
  // enriched records to 0.720 against a 0.75 floor. Records that had been published on the
  // registry row alone were rejected the moment someone did more research on them, which is the
  // exact opposite of what the floor is for.
  for (const raw of asRecordArray(row.payload.evidenceCitations)) {
    const url = typeof raw.sourceUrl === 'string' ? raw.sourceUrl.trim() : '';
    if (url.startsWith('https://')) urls.add(url);
  }
  // The canonical document corroborates claims taken from other documents; a claim's own
  // citation is excluded per-claim in minClaimConfidence, which is the only self-corroboration
  // guard needed. Deleting the canonical URL here as a second guard instead penalized every
  // OTHER claim: an evidence claim taken from a second document could no longer be corroborated
  // by the record's own canonical source. lineage resolution (resolveSourceLineage) already
  // collapses a canonical page and an evidence page from the same authority onto one lineage, so
  // a record with two pages from one institution gains nothing from including both here.
  return [...urls];
}

function minClaimConfidence(entry: ReleaseSourceEntity, row?: LandscapePublishRow): number {
  const claims = entry.claims ?? [];
  if (claims.length === 0) return 0;
  const corroborating = row ? corroboratingSourcesForLandscape(row) : [];
  let min = Number.POSITIVE_INFINITY;
  for (const [index, claim] of claims.entries()) {
    if (!claim.citationHref) continue;
    const citationHref = claim.citationHref;
    const sources = [
      { url: citationHref, textContainsSubjectName: true },
      // A claim does not corroborate itself: now that the evidence documents are in the
      // corroboration set, a claim citing one of them would otherwise be counted twice and
      // score higher than the single source it actually rests on.
      ...corroborating
        .filter((url) => url !== citationHref)
        .map((url) => ({ url, textContainsSubjectName: true })),
    ];
    const result = computeClaimConfidence(`${entry.id}-claim-${index}`, sources);
    min = Math.min(min, result.score);
  }
  return Number.isFinite(min) ? min : 0;
}

const GRANT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * An authored `statusHistory` for an invention row whose landscape payload carries a full grant
 * date, or `undefined` when it does not (or the kind is not `invention`).
 *
 * A grant date is a sourced fact about exactly when this record's lifecycle starts — sharper
 * than the era-bucket decade `earliestYear` falls back to in `deriveCatalogEntityStatus`
 * (packages/domain/src/derive-catalog-status.ts). This builds the authored entry that function's
 * existing pass-through already honors ("If the entry already has statusHistory ... pass
 * through") instead of adding a second invention-specific branch there: the status LABEL still
 * comes from the same heuristic every invention has always used, and only the date moves from
 * the decade to the day the grant states.
 */
function inventionGrantStatusHistory(
  row: LandscapePublishRow,
  fields: {
    readonly summary: string;
    readonly historicalContext?: string;
    readonly eraBuckets?: readonly string[];
  },
): ReleaseSourceEntity['statusHistory'] {
  if (row.kind !== 'invention') return undefined;
  const grantDate = typeof row.payload.grantDate === 'string' ? row.payload.grantDate.trim() : '';
  if (!GRANT_DATE_PATTERN.test(grantDate)) return undefined;

  const fallback = deriveCatalogEntityStatus({
    id: row.id,
    kind: row.kind,
    summary: fields.summary,
    ...(fields.historicalContext !== undefined
      ? { historicalContext: fields.historicalContext }
      : {}),
    ...(fields.eraBuckets !== undefined ? { eraBuckets: fields.eraBuckets } : {}),
  });
  const status = fallback.statusHistory?.[0]?.status ?? fallback.status;
  // `unknown` (and the person-only living/deceased values, unreachable for kind 'invention')
  // are not a lifecycle status this history can carry; leave the fallback path to report them.
  if (typeof status !== 'string' || status === 'unknown') return undefined;

  return [
    {
      status,
      validFrom: grantDate,
      datePrecision: 'day',
      basisClaimIds: [],
    },
  ];
}

export function buildReleaseSourceFromLandscape(
  row: LandscapePublishRow,
): ReleaseSourceEntity | null {
  const provenance = {
    ...asRecord(row.payload.provenance),
    ...row.provenance,
  };
  const displayName = row.display_name.trim();
  const summary = (row.summary ?? '').trim();
  const canonicalUrl = row.canonical_url?.trim() ?? '';
  // A registry index row is one way for a record to have a source, not the only one: a curated
  // record has no index entry and therefore no canonical_url, while still carrying the evidence
  // citations its prose was drafted from. So a row with no canonical_url builds PROVIDED it
  // carries at least one usable evidence citation (a source url AND a quote). With neither it
  // returns null and the gate reports `missing_canonical_url` — the gate fails closed on "no
  // source at all", not on "no index row". See also the claim guard below: a record with no index
  // row publishes no index claim, because there is no index row to cite.
  const hasCitableEvidence = asRecordArray(row.payload.evidenceCitations).some(
    (raw) =>
      typeof raw.sourceUrl === 'string' &&
      raw.sourceUrl.trim().length > 0 &&
      typeof raw.quote === 'string' &&
      raw.quote.trim().length > 0,
  );
  if (displayName.length === 0 || summary.length === 0) return null;
  if (canonicalUrl.length === 0 && !hasCitableEvidence) return null;
  if (row.lat === null || row.lng === null) return null;

  let hostname = 'source';
  try {
    hostname = new URL(canonicalUrl).hostname;
  } catch {
    // keep fallback
  }

  // Operator-attested living status from the privacy review marker (person rows).
  const review = asRecord(row.payload.personReview);
  const livingStatus =
    review.livingStatus === 'deceased' ||
    review.livingStatus === 'living' ||
    review.livingStatus === 'unknown'
      ? review.livingStatus
      : undefined;

  // A geocode fallback (e.g. reconcile-nrhp-county-locations.ts) records the real precision
  // of its coordinates here so the map renders an honest radius affordance instead of a
  // sharpened pin implying site-level accuracy the source data doesn't have. Per
  // docs/security/location-precision-standard.md §2, every raw precision is normalized onto
  // the controlled public tier list before it ever reaches the release builder. When there is
  // no geocode precision at all, a row carrying a street-address string (historicAddress) is
  // "address" tier; otherwise it fails safe to "city" (never the old bare "site" default,
  // which claimed building-level accuracy the row does not actually have).
  const geocode = asRecord(row.payload.geocode);
  const hasStreetAddress = readTrimmedString(provenance.historicAddress).length > 0;
  const locationPrecision =
    typeof geocode.precision === 'string' && geocode.precision.trim().length > 0
      ? normalizePublicPrecision(geocode.precision)
      : hasStreetAddress
        ? 'address'
        : 'city';

  // repo-n7p6.1: the NRHP Black-heritage lane used to reuse `summary` verbatim as the claim
  // object — one pasted string in summary, claims[0].object, AND (via buildNotabilityBasisNote's
  // predicate + claim.object derivation) notabilityBasis[0].note. Give it two distinct,
  // purpose-built claims instead: the listing FACT (claims[0], what the acceptance check reads)
  // and the significance criterion (its own claim so buildReleaseNotabilityBasis derives a real,
  // distinct note from it — the "landmark_or_national_register" criterion the listing-fact claim
  // triggers always sorts after the "documented_site" default the significance claim gets, so
  // the significance note lands at notabilityBasis[0]). Every other lane keeps the prior
  // single-claim behavior unchanged.
  //
  // repo-fz6k0: no canonical_url means no registry index entry, and a record cannot cite an
  // index row it does not have. Rather than promote some evidence document into the slot — which
  // would make the publisher assert that document "states" the whole summary, an attribution the
  // record cannot back — such a record publishes no record_index claim at all and stands on its
  // evidence claims below. Every row that HAS a canonical_url is unaffected.
  const claims: ReleaseSourceClaim[] =
    canonicalUrl.length === 0
      ? []
      : row.lane === 'nrhp-black-heritage'
        ? [
            {
              predicate: 'listing',
              object: buildNrhpListingFactObject({
                refnum: typeof row.payload.refnum === 'string' ? row.payload.refnum : undefined,
                listedDateSerial:
                  typeof row.payload.listedDateSerial === 'string' ||
                  row.payload.listedDateSerial === null
                    ? (row.payload.listedDateSerial as string | null)
                    : undefined,
              }),
              confidenceLevel: confidenceLevelForSource(canonicalUrl),
              citationSource: hostname,
              citationHref: canonicalUrl,
              citationLabel: hostname,
              claimRole: 'record_index',
            },
            {
              predicate: 'significant for',
              object: buildNrhpSignificanceObject({
                areaOfSignificance:
                  typeof row.payload.areaOfSignificance === 'string'
                    ? row.payload.areaOfSignificance
                    : undefined,
              }),
              confidenceLevel: confidenceLevelForSource(canonicalUrl),
              citationSource: hostname,
              citationHref: canonicalUrl,
              citationLabel: hostname,
              claimRole: 'record_index',
            },
          ]
        : [
            {
              // M3 (repo-teb1z). This predicate used to be the CRITERION NAME — `documented_site`,
              // or `documented_contribution` on an invention — which closed a loop: the publisher
              // wrote the word, `buildNotabilityBasisNote` led the inclusion note with it
              // ("Documented site <summary>."), and `inferNotabilityCriterionFromClaim` read the
              // same word back as the criterion it was supposed to determine. 238 basis records in
              // the active release began literally "Documented site", including on people.
              //
              // A predicate describes what the claim says. This claim says the source states the
              // summary, so that is what it says. The criterion is now decided by the inference and
              // the kind, where it belongs, and a record whose only claim is this index row keeps a
              // basis rather than a self-assertion — the honest residual that repo-o6k0c measures.
              predicate: 'source states',
              object: summary,
              confidenceLevel: confidenceLevelForSource(canonicalUrl),
              citationSource: hostname,
              citationHref: canonicalUrl,
              citationLabel: hostname,
              claimRole: 'record_index',
            },
          ];

  // repo-fbjr: the documents the enrichment sweep actually READ, as claims that cite them.
  //
  // Without this, an enriched record published citing only its registry index row: the nomination
  // form its every sentence came from appeared nowhere in the projection. Three things went wrong
  // at once — `assessLandscapeDepth` saw no document beyond the index row and rejected the record
  // as `template_only` unless it happened to have a historicalContext paragraph (6 of 21 in the
  // first live batch), `computeReleaseResearchCoverage` counted one distinct document and graded
  // a researched record 'minimal', and a reader was shown a federal index link as the sole source
  // for prose drawn from a 40,000-character nomination form.
  //
  // One claim per distinct DOCUMENT, not per citation: the drafts cite the same nomination form
  // several times over, and eight claims quoting one PDF would inflate the same count this is
  // meant to make honest. The object is the verbatim quote the draft anchored on, which is
  // already validated as a substring of that document's captured text — so the claim a reader
  // sees is the exact sentence the prose rests on, not a restatement of it.
  // A second quote from a document already cited is MERGED into that document's claim, not
  // dropped. One archival document routinely supports several distinct points, and discarding
  // the later ones threw away evidence a record had actually done the work to find: the
  // car-coupling record cites its state encyclopedia twice, once for a disputed injury account
  // and once for "it should not be confused with the Janney Coupler" — the sourced form of that
  // record's whole origin guard, which never reached a reader.
  //
  // Merging rather than appending a claim is what keeps the count above honest. Claim count is
  // what grades a record substantial, so eight claims quoting one PDF would buy a grade that one
  // document did not earn. One document still means one claim; it may now carry more than one of
  // the passages it was cited for, joined by an ellipsis in the ordinary way of quoting
  // non-contiguous text.
  const evidenceClaims: ReleaseSourceClaim[] = [];
  const claimByDocument = new Map<string, number>();
  const quotesByDocument = new Map<string, Set<string>>();
  const seenEvidenceDocuments = new Set([documentKey(canonicalUrl)].filter(Boolean) as string[]);
  for (const raw of asRecordArray(row.payload.evidenceCitations)) {
    const sourceUrl = typeof raw.sourceUrl === 'string' ? raw.sourceUrl.trim() : '';
    const quote = typeof raw.quote === 'string' ? raw.quote.trim() : '';
    if (sourceUrl.length === 0 || quote.length === 0) continue;
    const key = documentKey(sourceUrl);
    if (key === null) continue;

    const existingIndex = claimByDocument.get(key);
    if (existingIndex !== undefined) {
      const seenQuotes = quotesByDocument.get(key);
      const existing = evidenceClaims[existingIndex];
      if (!seenQuotes || !existing || seenQuotes.has(normalizeProse(quote))) continue;
      // Cap the merged object so a document cited many times publishes a readable claim rather
      // than a wall of quotations. Later passages are dropped at the cap, as before.
      const merged = `${existing.object} … ${quote}`;
      if (merged.length > MERGED_EVIDENCE_QUOTE_MAX_CHARS) continue;
      seenQuotes.add(normalizeProse(quote));
      evidenceClaims[existingIndex] = { ...existing, object: merged };
      continue;
    }

    // The canonical url's own document is seeded above: the record-index claim already cites it,
    // and a second claim on the same document would be the record citing itself.
    if (seenEvidenceDocuments.has(key)) continue;
    seenEvidenceDocuments.add(key);
    let evidenceHost = 'source';
    try {
      evidenceHost = new URL(sourceUrl).hostname;
    } catch {
      continue; // an unparseable url cannot be cited; drop rather than publish a broken link
    }
    const label =
      typeof raw.title === 'string' && raw.title.trim().length > 0
        ? raw.title.trim()
        : evidenceHost;
    claimByDocument.set(key, evidenceClaims.length);
    quotesByDocument.set(key, new Set([normalizeProse(quote)]));
    evidenceClaims.push({
      predicate: 'source states',
      object: quote,
      // Graded by what the document is, not by which sweep found it. The binary this replaced
      // never emitted `low`, so a Wikipedia page and a state archive's finding aid shipped as the
      // same `medium` and the meter had two values to render three segments with (repo-hqwt9).
      confidenceLevel: confidenceLevelForSource(sourceUrl),
      citationSource: evidenceHost,
      citationHref: sourceUrl,
      citationLabel: label,
      claimRole: 'evidence',
    });
  }
  claims.push(...evidenceClaims);

  // repo-fz6k0: fail closed. `hasCitableEvidence` above is a cheap pre-check on the raw payload;
  // this is the real one, after unparseable urls and same-document merges have been applied. A
  // record with no canonical_url whose every evidence citation dropped out would otherwise
  // publish with an empty claims array — a record asserting nothing, citing nothing. Returning
  // null here routes it back to the same `missing_canonical_url` skip it gets today.
  if (claims.length === 0) return null;

  // Enrichment writes its long-form prose back onto the landscape row; without this passthrough
  // the builder would rebuild the entity from index fields alone and silently drop it, so a
  // researched record would republish as thin as it started.
  const enrichedContext =
    typeof row.payload.historicalContext === 'string' ? row.payload.historicalContext.trim() : '';
  // Same passthrough for the rest of the enrichment harness's (repo-n7p6.4) output — these were
  // never wired in before because nothing wrote them onto a landscape row until WS4 existed.
  // Validated (isValidTopicId / decade-label format) by the harness before it ever reaches here;
  // buildReleaseEntityArtifacts re-validates topicIds against TOPIC_REGISTRY regardless, so an
  // unresolvable id fails the build rather than publishing silently.
  // `impactStatement` is required for `invention` (and law/case) by CONTENT_EXPECTATIONS, and it
  // is the field the content audit reads. Without this passthrough an authored statement sits on
  // the landscape row and never reaches the projection, so the record keeps failing a bar its own
  // source data already meets.
  const enrichedImpact =
    typeof row.payload.impactStatement === 'string' ? row.payload.impactStatement.trim() : '';
  const enrichedTopicIds = asStringArray(row.payload.topicIds);
  const enrichedEraBuckets = asStringArray(row.payload.eraBuckets);
  const enrichedKeywords = asStringArray(row.payload.keywords);
  // Same passthrough for related entity ids. `resolveReleaseEntityReferences` deliberately does
  // not validate these against the release or canonical graph (see release-builder.ts's header
  // doc comment): legacy-tag placeholder strings pending real entity resolution are expected,
  // so no existence check is added here either.
  const enrichedMentionedEntityIds = asStringArray(row.payload.mentionedEntityIds);
  const grantStatusHistory = inventionGrantStatusHistory(row, {
    summary,
    ...(enrichedContext.length > 0 ? { historicalContext: enrichedContext } : {}),
    ...(enrichedEraBuckets.length > 0 ? { eraBuckets: enrichedEraBuckets } : {}),
  });

  return {
    id: row.id,
    kind: row.kind,
    displayName,
    summary,
    ...(enrichedContext.length > 0 ? { historicalContext: enrichedContext } : {}),
    ...(enrichedImpact.length > 0 ? { impactStatement: enrichedImpact } : {}),
    ...(enrichedTopicIds.length > 0 ? { topicIds: enrichedTopicIds } : {}),
    ...(enrichedEraBuckets.length > 0 ? { eraBuckets: enrichedEraBuckets } : {}),
    ...(enrichedKeywords.length > 0 ? { keywords: enrichedKeywords } : {}),
    ...(grantStatusHistory !== undefined ? { statusHistory: grantStatusHistory } : {}),
    ...(livingStatus !== undefined ? { livingStatus } : {}),
    jurisdictionLabel: jurisdictionFromPlace({
      ...placeFieldsFromLandscape(row),
      lat: row.lat,
      lng: row.lng,
    }),
    locationPrecision,
    locationLabel: locationLabelFromProvenance(displayName, provenance, row.kind),
    lat: row.lat,
    lng: row.lng,
    claims,
    mentionedEntityIds: enrichedMentionedEntityIds,
  };
}

/**
 * Compares citation URLs at document granularity, not host. An NRHP row's nomination form — the
 * richest evidence the lane has, and the whole point of the sweep — lives on the same host as the
 * registry index entry it was found through. Comparing hosts would reject exactly the records
 * that had the most research done on them.
 */
function documentKey(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/u, '');
    return `${parsed.hostname.replace(/^www\./iu, '').toLowerCase()}${path}${parsed.search}`;
  } catch {
    return null;
  }
}

function normalizeProse(text: string): string {
  return text.trim().replace(/\s+/gu, ' ').replace(/\.$/u, '').toLowerCase();
}

export type DepthAssessment =
  { readonly deep: true } | { readonly deep: false; readonly detail: string };

/**
 * The published state of a record that is already live, in the only shape the depth gate reads.
 * `projection` carries `historicalContext`; `summary` and `claims` are the columns themselves.
 */
export type LivePublishedRow = {
  readonly summary: string | null;
  readonly claims: unknown;
  readonly projection: Record<string, unknown> | null;
};

/**
 * Rebuild only the three fields `assessLandscapeDepth` actually reads (summary,
 * historicalContext, claims) from an already-published row, so the gate can be asked what it
 * thinks of what is CURRENTLY live rather than only of the candidate.
 *
 * Reconstructing a fuller `ReleaseSourceEntity` would invite callers to depend on fields the gate
 * ignores, and any mismatch there would look like a gate disagreement when it is really a
 * reconstruction artifact. This started life inside `audit-live-depth-gate.ts` (repo-r8qh) and
 * moved here when the publisher needed the same reconstruction — one copy, so an audit verdict and
 * a publish verdict on the same live row cannot differ.
 */
export function buildLiveDepthEntry(row: LivePublishedRow): ReleaseSourceEntity {
  const projection = row.projection ?? {};
  const historicalContext =
    typeof projection.historicalContext === 'string' ? projection.historicalContext : undefined;
  return {
    summary: row.summary ?? '',
    historicalContext,
    claims: Array.isArray(row.claims) ? row.claims : [],
  } as unknown as ReleaseSourceEntity;
}

/**
 * The same claim-confidence measure the gate applies to a candidate (`minClaimConfidence`),
 * applied instead to what is CURRENTLY published for this entity (repo-2t04.17). Reuses
 * `buildLiveDepthEntry`'s reconstruction rather than inventing a second one, so a depth verdict
 * and a confidence verdict on the same live row are always built from the same claims array. No
 * `row` argument (and so no corroborating-source lookup): a `LivePublishedRow` has no
 * landscape-candidate provenance to corroborate from, only the claims it already carries.
 */
export function liveClaimConfidence(row: LivePublishedRow): number {
  return minClaimConfidence(buildLiveDepthEntry(row));
}

/**
 * The claims an already-published row carries, read back as source claims.
 *
 * A published claim is stored in the same shape it was built from — `predicate`, `object`,
 * `confidenceLevel`, the three citation fields and `claimRole` — so a live row round-trips into
 * `ReleaseSourceClaim` without reconstruction. The `id` rides along because
 * `resolveReleaseClaimId` prefers a claim's own id over a positional one, which is what keeps a
 * carried claim's id stable across a republish.
 */
export function liveSourceClaims(row: LivePublishedRow): readonly ReleaseSourceClaim[] {
  return asRecordArray(row.claims)
    .filter(
      (claim) =>
        typeof claim.predicate === 'string' &&
        claim.predicate.trim().length > 0 &&
        typeof claim.object === 'string' &&
        claim.object.trim().length > 0,
    )
    .map((claim) => {
      const level = claim.confidenceLevel;
      return {
        ...(typeof claim.id === 'string' && claim.id.length > 0 ? { id: claim.id } : {}),
        predicate: String(claim.predicate),
        object: String(claim.object),
        confidenceLevel:
          level === 'high' || level === 'medium' || level === 'low' ? level : ('low' as const),
        citationSource: typeof claim.citationSource === 'string' ? claim.citationSource : 'source',
        ...(typeof claim.citationHref === 'string' && claim.citationHref.length > 0
          ? { citationHref: claim.citationHref }
          : {}),
        citationLabel:
          typeof claim.citationLabel === 'string' && claim.citationLabel.length > 0
            ? claim.citationLabel
            : typeof claim.citationSource === 'string'
              ? claim.citationSource
              : 'source',
        ...(claim.claimRole === 'record_index' || claim.claimRole === 'evidence'
          ? { claimRole: claim.claimRole }
          : {}),
      } satisfies ReleaseSourceClaim;
    });
}

/** Identity of a claim as a reader meets it: what it says, about what. */
function claimIdentity(claim: ReleaseSourceClaim): string {
  return `${claim.predicate.trim().toLowerCase()} ${claim.object.trim().toLowerCase()}`;
}

export type ClaimCarryResult = {
  readonly claims: readonly ReleaseSourceClaim[];
  /** Live claims the rebuild did not reproduce, kept rather than dropped. */
  readonly carried: number;
  readonly rebuilt: number;
  readonly liveCount: number;
};

/**
 * Union of what a republish rebuilds with what the record already publishes.
 *
 * A landscape row is a candidate's worth of evidence, not the record's history. Rebuilding claims
 * from it alone republishes only what that row can currently prove, so a record that accumulated
 * fine-grained, separately-cited facts (`founded | 1883`, `motive | Anti-Black racism`) loses them
 * and keeps one coarse claim whose object is the whole summary. That trades evidence a reader can
 * check for prose they cannot, which is the opposite of what the depth and confidence apparatus
 * exists to protect — measured across the 26 curated gap_* candidates, a republish took 106
 * published claims down to 27.
 *
 * So a rebuilt claim wins where both describe the same fact, and every live claim the rebuild did
 * not reproduce is carried forward. Identity is the pair a reader actually reads — predicate and
 * object, trimmed and case-folded — not the claim id, because the same fact re-cited from a fresh
 * sweep is a new id for an old statement.
 *
 * The union never shrinks a record. `claimCountRegressed` is the control that says so out loud.
 */
export function carryLiveClaims(
  rebuilt: readonly ReleaseSourceClaim[],
  live: LivePublishedRow | undefined,
): ClaimCarryResult {
  const liveClaims = live === undefined ? [] : liveSourceClaims(live);
  if (liveClaims.length === 0) {
    return { claims: rebuilt, carried: 0, rebuilt: rebuilt.length, liveCount: 0 };
  }

  const seen = new Set(rebuilt.map(claimIdentity));
  const carried: ReleaseSourceClaim[] = [];
  for (const claim of liveClaims) {
    const identity = claimIdentity(claim);
    if (seen.has(identity)) continue;
    seen.add(identity);
    carried.push(claim);
  }

  return {
    claims: [...rebuilt, ...carried],
    carried: carried.length,
    rebuilt: rebuilt.length,
    liveCount: liveClaims.length,
  };
}

/**
 * Whether a republish would publish fewer claims than the record already carries.
 *
 * With `carryLiveClaims` applied this cannot happen, which is the point: it is a control on the
 * carry rather than a second implementation of it. A true here means the union did not run, ran
 * against the wrong live row, or a future change reintroduced the rebuild-only path — and the
 * publisher refuses the record instead of quietly shipping the smaller set, because a claim that
 * disappears leaves no trace on the page that it was ever there.
 */
export function claimCountRegressed(
  published: readonly ReleaseSourceClaim[],
  live: LivePublishedRow | undefined,
): boolean {
  if (live === undefined) return false;
  return published.length < liveSourceClaims(live).length;
}

/**
 * The location an already-live record publishes today, in the shape a republish needs to keep it.
 * `ReleaseLocationOverride` covers the point; `jurisdictionLabel` rides along because the release
 * builder takes that one from the source entry, not from the override.
 */
export type LiveLocationInheritance = ReleaseLocationOverride & {
  readonly jurisdictionLabel?: string;
};

/**
 * Reads the live projection's own published location off a `LivePublishedRow` (repo-lai8y), the
 * third member of the `buildLiveDepthEntry` / `liveClaimConfidence` family: one reader per thing
 * the gate wants to know about what is CURRENTLY public, so an audit and a publish cannot read
 * the same live row differently.
 *
 * Returns undefined unless the projection carries a finite lat AND lng — the caller's fallback
 * then has nothing to offer and the location gate fails closed exactly as before.
 */
export function liveLocationFromRow(row: LivePublishedRow): LiveLocationInheritance | undefined {
  const projection = row.projection ?? {};
  const location = asRecord(projection.location);
  const lat = location.lat;
  const lng = location.lng;
  if (typeof lat !== 'number' || !Number.isFinite(lat)) return undefined;
  if (typeof lng !== 'number' || !Number.isFinite(lng)) return undefined;
  /*
   * A live tier that was REDUCED (living residence, restricted site, withheld on request) cannot
   * be inherited faithfully. `reducePublicPrecision` is the publish path's one engine for that
   * decision and it re-derives from kind/livingStatus/sensitivityClass — inputs a landscape row
   * does not carry (`buildReleaseSourceFromLandscape` never sets `sensitivityClass`). Feeding the
   * already-reduced tier back in makes the rule a no-op, so the record would republish at the
   * right tier with its `precisionReductionReason` silently dropped, breaking the standard's §4
   * control that a location is published either at its source precision or with a reason code.
   *
   * So: fail closed. The record skips as `missing_location` and keeps its stale summary, which is
   * the honest outcome for a record whose location we cannot reproduce. Zero of the 57 rows this
   * was written for carry a reason code. If this ever does fire, the fix is to carry the
   * sensitivity INPUTS onto the candidate, not to copy the engine's output past the engine.
   */
  if (readTrimmedString(location.precisionReductionReason).length > 0) return undefined;
  const precision = readTrimmedString(location.precision);
  const matchMethod = readTrimmedString(location.matchMethod);
  const locationLabel = readTrimmedString(projection.locationLabel);
  const jurisdictionLabel = readTrimmedString(projection.jurisdictionLabel);
  return {
    lat,
    lng,
    ...(precision.length > 0 ? { precision } : {}),
    ...(matchMethod.length > 0 ? { matchMethod } : {}),
    ...(locationLabel.length > 0 ? { locationLabel } : {}),
    ...(jurisdictionLabel.length > 0 ? { jurisdictionLabel } : {}),
  };
}

/**
 * Applies an already-live record's location to a republish candidate whose landscape row carries
 * no coordinates (repo-lai8y). Splits the decision the way the data splits:
 *
 *   POINT METADATA (lat/lng, precision, matchMethod) always comes from the live projection. A
 *   precision tier and a match method describe a POINT, and the point here is the live one, so
 *   re-deriving them from a row that has no coordinates describes someone else's point. Measured
 *   on the 57 rows this was written for, every landscape row carries no geocode, no street
 *   address and no city/state at all, so `buildReleaseSourceFromLandscape`'s derivation returns
 *   'city' for all of them while their live records publish at neighborhood (4), campus (6),
 *   institution (16), site (3), address (4) and country (1) — 34 rows whose published precision
 *   a bare lat/lng inheritance would coarsen or sharpen against the point it describes.
 *
 *   PLACE PROSE (locationLabel, jurisdictionLabel) comes from the landscape row whenever that row
 *   supplies a place field that derivation can actually use, and from the live projection
 *   otherwise (see the per-field reasoning at the branch). A row that says where the record is stays the source
 *   of truth for what a reader is told; a row that says nothing must not overwrite what the
 *   record's own page already prints. On those same 57 rows nothing is supplied, so
 *   'Boston, Massachusetts' would otherwise degrade to 'Massachusetts' (`jurisdictionFromPlace`
 *   falling through to `findUsStateForPoint`) and '46 Joy Street, Beacon Hill, Boston' to the
 *   record's own display name (`locationLabelFromProvenance`'s last resort).
 *
 * The same values are written onto BOTH the entry and the override rather than only the override.
 * The release builder reads `locationOverride?.x ?? entry.x` for precision and label, so the two
 * cannot disagree — and a caller that forgets to forward the override still republishes the right
 * tier and label instead of a silently re-derived one.
 */
function inheritLiveLocation(input: {
  readonly entry: ReleaseSourceEntity;
  readonly row: LandscapePublishRow;
  readonly live: LiveLocationInheritance;
}): {
  readonly entry: ReleaseSourceEntity;
  readonly locationOverride: ReleaseLocationOverride;
} {
  const place = placeFieldsFromLandscape(input.row);
  /*
   * Decided per field, on what each derivation can actually produce from THIS row — not on one
   * "does the row have place data" flag, which would let a row naming only a state overwrite a
   * city-precise live label with the bare state name. Naming a state does not contradict
   * 'Boston, Massachusetts'; it just says less, and a fallback that loses information is not a
   * fallback.
   *
   *   jurisdiction: `jurisdictionFromPlace` returns 'City, State' only when the row names a city.
   *     Without one it returns the state alone, or falls through to `findUsStateForPoint` — both
   *     strictly less than what the live record already prints.
   *
   *   label: `locationLabelFromProvenance` returns the record's own display name when the row
   *     gave it nothing to work with. Comparing against that is the tell, rather than guessing
   *     which provenance fields it consulted for this kind.
   */
  const rowNamesJurisdiction = place.city.length > 0;
  const rowNamesLocation = input.entry.locationLabel !== input.row.display_name.trim();
  const locationLabel = rowNamesLocation ? undefined : input.live.locationLabel;
  const jurisdictionLabel = rowNamesJurisdiction ? undefined : input.live.jurisdictionLabel;
  return {
    entry: {
      ...input.entry,
      lat: input.live.lat,
      lng: input.live.lng,
      ...(input.live.precision !== undefined ? { locationPrecision: input.live.precision } : {}),
      ...(locationLabel !== undefined ? { locationLabel } : {}),
      ...(jurisdictionLabel !== undefined ? { jurisdictionLabel } : {}),
    },
    locationOverride: {
      lat: input.live.lat,
      lng: input.live.lng,
      ...(input.live.precision !== undefined ? { precision: input.live.precision } : {}),
      ...(input.live.matchMethod !== undefined ? { matchMethod: input.live.matchMethod } : {}),
      ...(locationLabel !== undefined ? { locationLabel } : {}),
    },
  };
}

/**
 * Rejects rows that carry nothing a reader could not get from the registry index entry itself.
 *
 * The lane importers publish prose generated from index fields — category, city, state, area of
 * significance, listed date — and the only bar in front of them was "summary is non-empty", which
 * a template satisfies by construction. That is how 2,578 records reached the public release
 * asserting a history nobody had researched, three of them saying the same sentence in the
 * summary, the sole claim, and the notability note.
 *
 * A row clears this gate by carrying evidence, in one of two forms:
 *   - `historicalContext`, which only the enrichment harness writes, and only from swept sources;
 *   - a claim citing a document other than the row's own registry index entry — a nomination
 *     form, a newspaper page, an archive record — whether or not it shares that entry's host.
 *
 * A lane-constant corroborating URL (the DC program's catalog page, identical on every row in the
 * lane) deliberately does NOT count. It already lifts the confidence score, and treating it as
 * per-entity evidence here would let an entire lane through on one shared link.
 *
 * Rejected rows are not discarded — they stay in the research lane, where the enrichment sweep
 * picks them up, and the record surfaces its honest registry-listing state instead of publishing
 * as though the work were done.
 */
export function assessLandscapeDepth(
  entry: ReleaseSourceEntity,
  row: LandscapePublishRow,
): DepthAssessment {
  const context = entry.historicalContext?.trim() ?? '';
  if (context.length > 0) return { deep: true };

  // Read off the ROW, not the entry: this is the registry index document the record was found
  // through, and a claim that merely cites it back is not evidence of anything beyond the listing.
  //
  // repo-fz6k0: for a curated row with no canonical_url this is null, so every claim carrying a
  // parseable url counts as independent and the record passes. That is the correct reading, not a
  // hole to plug — such a record has no "own registry index entry" to exclude, and (since that
  // same bead) publishes no record_index claim either, so the only claims it can offer here are
  // the evidence documents the draft actually read. Do not "fix" this by falling back to some
  // evidence url as the registry document; that would exclude the record's own real evidence.
  const registryDocument = documentKey(row.canonical_url);
  const claims = entry.claims ?? [];
  const hasIndependentSource = claims.some((claim) => {
    const key = documentKey(claim.citationHref);
    return key !== null && key !== registryDocument;
  });
  if (hasIndependentSource) return { deep: true };

  const summary = entry.summary;
  const signature = findTemplateSummarySignature(summary);
  if (signature !== null) {
    return {
      deep: false,
      detail: `summary carries a generated-template signature ("${signature.slice(0, 48)}…")`,
    };
  }

  const normalizedSummary = normalizeProse(summary);
  const echoed = claims.filter((claim) => normalizeProse(claim.object) === normalizedSummary);
  if (echoed.length === claims.length && claims.length > 0) {
    return {
      deep: false,
      detail: 'every claim restates the summary verbatim — no fact beyond the registry listing',
    };
  }

  return {
    deep: false,
    detail: `no evidence beyond the registry index row (${registryDocument ?? 'unknown source'})`,
  };
}

export function gateLandscapePublishCandidate(input: {
  readonly row: LandscapePublishRow;
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly confidenceFloor?: number;
  readonly canonicalStatus?: CanonicalStatusSnapshot;
  /**
   * repo-n7p6.1: a correction pass re-derives claims/notabilityBasis for landscape rows that are
   * already `status='accepted'` and already published in the active release (e.g. the NRHP
   * raw-code-leak fix) — `exact_in_release` would otherwise always skip those with
   * 'already_in_public', since that check exists to stop a *new* candidate from duplicating an
   * entity id already live. When true, that one check is skipped so the normal build path below
   * re-derives and upserts the entity's row in place; every other gate (privacy review, lane
   * bans, location, name_overlap) still applies unchanged.
   */
  readonly allowRepublish?: boolean;
  /**
   * repo-b4ad: the depth verdict on what is CURRENTLY published for this entity, from
   * `assessLandscapeDepth(buildLiveDepthEntry(liveRow), row)`. Supplying it turns the depth check
   * into a non-regression test for an already-live record (see the ADMISSION vs REGRESSION note
   * below). Omitting it leaves the strict admission test in force — the gate fails closed, so a
   * caller that has not loaded live state cannot accidentally relax anything.
   */
  readonly liveDepth?: DepthAssessment;
  /**
   * repo-2t04.17: the confidence score of what is CURRENTLY published for this entity, from
   * `liveClaimConfidence(liveRow)`. Mirrors `liveDepth` exactly — same ADMISSION vs REGRESSION
   * reasoning, applied to confidence instead of depth. Omitting it leaves the strict admission
   * test in force.
   */
  readonly liveConfidence?: number;
  /**
   * repo-lai8y: the location of what is CURRENTLY published for this entity, from
   * `liveLocationFromRow(liveRow)`. Read ONLY when the landscape row carries no coordinates and
   * this is a republish of that live row; see the location gate below. Omitting it leaves the
   * gate failing closed on a coordinate-less row, which is what every non-republish caller
   * (e.g. enrich-landscape-pending-corroboration.ts, which has no live state at all) wants.
   */
  readonly liveLocation?: LiveLocationInheritance;
  /**
   * Raw (pre-gating) visit-contact input from `bb_canonical.entity_visit` +
   * `entity_locations.street`/`postal_code`, when the caller looked one up for this entity
   * (`visitOverrideFromCanonicalRow`). Wins over whatever `buildReleaseSourceFromLandscape`
   * derived from the landscape row (normally nothing — the landscape payload carries no visit
   * data) and is gated through `publicVisitForTier` inside `buildReleaseEntityArtifacts`, same
   * precedence as `canonicalStatus` above. Omitting it leaves that empty derivation in force,
   * which is how a republish silently dropped a backfilled phone/website/street before this was
   * wired in.
   */
  readonly visitOverride?: PublicVisit;
}): PublishGateResult {
  const floor = input.confidenceFloor ?? INCREMENTAL_PUBLISH_CONFIDENCE_FLOOR;
  const row = input.row;

  const reviewed = personReviewApproved(row.payload);
  if (row.kind === 'person' && !reviewed) {
    return {
      eligible: false,
      reason: 'person_kind',
      detail: 'kind=person requires privacy review',
    };
  }
  if (resolveSourceCategory(row) === 'People' && !reviewed) {
    return {
      eligible: false,
      reason: 'people_category',
      detail: 'sourceCategory=People requires privacy review',
    };
  }
  if (row.lane === 'greenbook') {
    return {
      eligible: false,
      reason: 'greenbook_lane',
      detail: 'Green Book lane requires living/residence review',
    };
  }
  // Hoisted above the location gate (it was declared just below `name_overlap`) because the
  // location gate is now the third check to ask the ADMISSION vs REGRESSION question.
  const republishingLiveRow = input.allowRepublish === true && row.exact_in_release === true;

  /*
   * ADMISSION vs REGRESSION (repo-lai8y), the third gate to draw this distinction after depth
   * (repo-b4ad) and confidence (repo-2t04.17).
   *
   *   new record   -> ADMISSION. Unchanged: no coordinates, no publish. The check exists for
   *                   buildability, not editorial policy — `ReleaseEntityUpsertRow.lat/lng` are
   *                   non-nullable and `buildGeoPointFields` THROWS on a non-finite lat/lng, so
   *                   this gate is what turns that throw into an honest skip.
   *
   *   already live -> REGRESSION. The record already holds a place, and its own page prints it.
   *                   This pass is correcting the record's PROSE, not its location, and a
   *                   landscape row that never carried coordinates is not evidence that the
   *                   place is gone — it is evidence that this lane never geocoded. Rejecting it
   *                   here does not un-place anything; it only keeps the stale summary public.
   *                   Same principle as commit 26a2d036, one layer earlier: a republished record
   *                   keeps the place its own page prints.
   *
   * Measured 2026-09-12: 56 of the 661 staged republish candidates were skipped as
   * missing_location, all 57 coordinate-less rows in that set are live, and all 57 live records
   * carry a real projection.location — including the 24 gap_* drafts of repo-2t04.9, which had
   * been blocked here since 2026-08-17.
   *
   * The fallback is deliberately narrow: it needs an explicit `--republish`, a row already live
   * under its own id, and a live projection that actually carries a finite point. A caller that
   * loads no live state cannot relax anything by accident, and a row WITH coordinates is
   * untouched by this branch — the 477 candidates that already republished are unaffected.
   */
  const inheritedLocation =
    (row.lat === null || row.lng === null) && republishingLiveRow ? input.liveLocation : undefined;
  const locatedRow =
    inheritedLocation === undefined
      ? row
      : { ...row, lat: inheritedLocation.lat, lng: inheritedLocation.lng };
  if (locatedRow.lat === null || locatedRow.lng === null) {
    return { eligible: false, reason: 'missing_location', detail: 'missing lat/lng' };
  }
  if (row.exact_in_release && !input.allowRepublish) {
    return {
      eligible: false,
      reason: 'already_in_public',
      detail: 'entity id already in active release',
    };
  }
  // repo-8dlu: the same ADMISSION vs REGRESSION distinction the depth gate makes below.
  //
  // For a NEW candidate this check is right and unchanged: do not admit a second
  // "Mount Zion Missionary Baptist Church" whose name collides with one already public, because
  // readers cannot tell two identically-named records apart.
  //
  // For a row ALREADY LIVE under its own entity id it asks the wrong question. The record is not
  // competing for a name — it already holds one, and this is an in-place correction of the text
  // under that name. Blocking it changes nothing about the collision and only keeps the stale
  // prose public. It fires hardest on exactly the names that repeat by nature (AME churches,
  // Mount Zion Baptist, Lincoln School), which is why it was pinning 99 live summaries that still
  // print the raw NPS code `ethnic heritage (Black)` while their corrected, researched prose sat
  // in bb_research at status='accepted'.
  //
  // The SQL behind `name_overlap` already excludes the row's own ids (LANDSCAPE_BY_LANE_SQL:
  // `re.entity_id <> lc.id AND re.entity_id <> lc.source_item_id`), so a genuine collision with a
  // DIFFERENT live entity still sets the flag. Skipping it here is a decision about what to do
  // with that flag on a republish, not a loosening of how it is computed.
  if (row.name_overlap && !republishingLiveRow) {
    return {
      eligible: false,
      reason: 'name_overlap',
      detail: 'display_name overlaps existing release entity',
    };
  }

  // `locatedRow` only ever differs from `row` in lat/lng, and only on the inheritance branch
  // above. It is used HERE rather than for every later `row` read because this is the one call
  // that reads the row's location: `assessLandscapeDepth` and the confidence engine below read
  // canonical_url, payload and provenance, where the two rows are identical by construction.
  const builtEntry = buildReleaseSourceFromLandscape(locatedRow);
  if (!builtEntry) {
    return {
      eligible: false,
      reason: 'missing_canonical_url',
      detail:
        'insufficient landscape fields to build release source (no canonical_url AND no citable evidence citation, or no usable location)',
    };
  }
  const inherited =
    inheritedLocation === undefined
      ? undefined
      : inheritLiveLocation({ entry: builtEntry, row, live: inheritedLocation });
  const entry = inherited?.entry ?? builtEntry;
  const locationOverride = inherited?.locationOverride;
  // Enrichment and landscape staging require summaries within the current editorial band
  // (repo-2t04.1: 400-900, was 220-400). Best-effort short drafts are validated and
  // ledger-flagged at draft time (entity-enrichment-llm.ts); this coarse length gate does not
  // yet see that flag, so a legitimate best-effort record still needs a human override to stage
  // — known gap, not silently swallowed. Kept in sync with the draft-time bounds via the shared
  // constants rather than a second hardcoded pair of numbers.
  if (entry.summary.length < SUMMARY_MIN_CHARS || entry.summary.length > SUMMARY_MAX_CHARS) {
    return {
      eligible: false,
      reason: 'summary_too_short',
      detail:
        `summary length ${entry.summary.length} outside enrichment bounds ` +
        `${SUMMARY_MIN_CHARS}..${SUMMARY_MAX_CHARS}`,
    };
  }

  // ADMISSION vs REGRESSION (repo-b4ad). One depth verdict, two different questions:
  //
  //   new record        -> ADMISSION.  "Is this good enough to appear in public at all?"
  //                        Strict, unchanged: the record must be deep. This is the bar the gate
  //                        was written for, and the 2,578 unresearched records in its header are
  //                        why it does not move.
  //
  //   already live      -> REGRESSION. "Is this good enough to REPLACE what readers see today?"
  //                        The comparison that matters is candidate-vs-published, not
  //                        candidate-vs-floor. Asking the admission question here is what pinned
  //                        2,360 live records in place: their corrected prose is shallow by the
  //                        same measure as the prose already public, so the publisher skipped
  //                        them and the stale text stayed — including 98 summaries still printing
  //                        the raw NPS code 'ethnic heritage (Black)' whose fixed form has been
  //                        sitting in bb_research the whole time.
  //
  // A live-shallow record cannot be made worse by any replacement: the gate's own verdict on the
  // published text is already "does not clear the bar". A live-DEEP record still cannot be
  // overwritten by a shallow candidate — that is the one transition this must forbid, and it
  // stays forbidden below.
  //
  // Nothing here lets templated prose masquerade as researched. A summary carrying a registered
  // fingerprint is capped at researchCoverage='minimal' by `computeReleaseResearchCoverage`
  // (repo-vymq), so a record admitted by the regression clause publishes visibly thin, stays in
  // the enrichment queue, and keeps counting against `audit-live-depth-gate.ts`.
  const depth = assessLandscapeDepth(entry, row);
  if (!depth.deep) {
    const liveIsShallow = input.liveDepth !== undefined && !input.liveDepth.deep;
    if (!republishingLiveRow || !liveIsShallow) {
      return { eligible: false, reason: 'template_only', detail: depth.detail };
    }
  }

  const payloadConfidence = readPayloadConfidence(row.payload);
  const claimConfidence = minClaimConfidence(entry, row);
  const confidence = payloadConfidence ?? claimConfidence;
  if (confidence < floor) {
    // ADMISSION vs REGRESSION for confidence (repo-2t04.17), same shape as the depth clause
    // above. The floor was written to keep an unresearched record from reaching the public
    // corpus for the first time; it was never asked whether a correction to an ALREADY-LIVE
    // record should have to out-score a bar the live text itself may not clear. A legitimate
    // institutional citation (e.g. a reputable_secondary .edu source) can score under 0.75 on
    // the blended measure without being wrong — `CLASSIFICATION_AUTHORITY.reputable_secondary`
    // alone is 0.75; it is the directness/entity-match defaults that pull a shallow-evidenced
    // claim on it below the floor. Reclassifying such a host as `primary_archival` to clear the
    // floor would be dishonest score-gaming, not a fix — this clause lets the actual comparison
    // that matters (candidate vs. what readers see today) decide instead.
    //
    // A live-low-confidence record cannot be made worse by a replacement that scores no lower
    // than it: allow only when this is a republish of that same live row, a live confidence
    // score was supplied, that live score is itself below the floor, and the candidate does not
    // score below it. A live record that already clears the floor still cannot be overwritten
    // by a weaker candidate — that transition stays forbidden.
    const liveConfidenceBelowFloor =
      input.liveConfidence !== undefined && input.liveConfidence < floor;
    const notARegression = input.liveConfidence !== undefined && confidence >= input.liveConfidence;
    if (!republishingLiveRow || !liveConfidenceBelowFloor || !notARegression) {
      return {
        eligible: false,
        reason: 'confidence_below_floor',
        detail: `confidence ${confidence.toFixed(3)} < floor ${floor}`,
      };
    }
  }

  const build = buildReleaseEntityArtifacts(
    entry,
    buildContext({
      releaseId: input.releaseId,
      generatedAt: input.generatedAt,
      ...(input.canonicalStatus !== undefined ? { canonicalStatus: input.canonicalStatus } : {}),
      ...(input.visitOverride !== undefined ? { visitOverride: input.visitOverride } : {}),
      ...(locationOverride !== undefined ? { locationOverride } : {}),
    }),
  );
  if (!build.ok) {
    return {
      eligible: false,
      reason: 'build_failed',
      detail: `${build.reason}: ${build.message}`,
    };
  }

  return {
    eligible: true,
    entry,
    confidence,
    ...(locationOverride !== undefined ? { locationOverride } : {}),
  };
}

export function toReleaseEntityRow(
  projection: ReleaseEntityProjectionFields,
): ReleaseEntityUpsertRow {
  const related = normalizeReleaseRelated(projection.related);
  const claims = normalizeReleaseClaims(projection.claims);
  return {
    release_id: projection.releaseId,
    entity_id: projection.id,
    display_name: projection.displayName,
    kind: projection.kind,
    summary: projection.summary,
    location: projection.location,
    geohash: projection.location.geohash,
    lat: projection.location.lat,
    lng: projection.location.lng,
    claims,
    taxonomy: {
      topicTags: projection.topicTags,
      topicIds: projection.topicIds,
      notabilityLabels: projection.notabilityLabels,
    },
    related,
    projection: {
      ...projection,
      ...(projection.related === undefined && related.length === 0 ? { related: [] } : {}),
    },
  };
}

export function toSearchIndexRow(
  searchIndex: ReleaseSearchIndexFields,
  geohash: string,
): SearchIndexUpsertRow {
  return {
    // Composite id matches the primary release publisher; a plain entity id here
    // creates a second search row for entities that already have a composite-id row.
    id: `${searchIndex.releaseId}:${searchIndex.id}`,
    release_id: searchIndex.releaseId,
    entity_id: searchIndex.id,
    name: searchIndex.displayName,
    name_lower: searchIndex.nameLower,
    aliases: searchIndex.aliases ?? [],
    /*
     * repo-ttlce: NON-EMPTY tags, else ids — not `??`, which falls through only on nullish. Every
     * lane whose topics are ids without display tags builds `topicTags: []`, so the nullish form
     * wrote an EMPTY topics column over real topics on 2,141 live rows (repo-p1m1y, measured
     * 2026-09-12), taking every incrementally published record out of topic browse and topic
     * filters while its projection still looked correct. Shared with the divergence audit and the realigner so the rule cannot
     * drift a fourth time.
     */
    topics: [...searchTopicsFromProjection(searchIndex)],
    kind: searchIndex.kind,
    status: searchIndex.status ?? null,
    geohash,
    related_count: searchIndex.relatedCount ?? 0,
    claim_count: searchIndex.claimCount ?? 0,
    /**
     * Every field the search-doc reader can reach ONLY through `facets`.
     *
     * `search_index` has columns for name, kind, status, topics, aliases, geohash and the two
     * counts, so those stay out of here — `mapPostgresSearchIndexRow`
     * (`packages/schemas/src/search-index-row.ts`) prefers the column and the duplicate would
     * only be a second copy to keep in sync. Everything below has no column, which makes this
     * object the record's only carrier for it.
     *
     * That is the load-bearing half. `upsertSearchIndex` writes `facets = EXCLUDED.facets`, a
     * whole-object replace, so a key missing here is not merely unset — it is *deleted* from any
     * row this publisher touches again. The first five keys were the whole list, and the six
     * added below were dropped on every incremental publish. The reader's fallbacks made the
     * loss silent rather than loud: `jurisdictionState` simply went absent, and `/records`
     * printed the literal "Place not recorded" over a record whose own entity page prints its
     * city (repo-2t04.14). The 32-record invention cohort published exclusively through this path
     * and so lost all six at 100%; kinds that predate it lost them only on rows republished
     * since, which is the partial drift
     * `backfill-search-facets-jurisdiction.ts` was written to mop up. That backfill treats the
     * release projection as the authority and copies it back onto the search doc; keeping this
     * list complete is what stops it from being needed again.
     *
     * Two reader keys are deliberately absent. `campaignIds` is not on
     * `ReleaseSearchIndexFields` at all, so there is nothing here to carry, and the reader
     * already defaults it to `[]`. `summary` is a size decision rather than an oversight: it is
     * absent from all but seven rows catalog-wide, so adding it on this path alone would make
     * summary search work for incrementally published records and no others, while adding
     * several MB to the index. Both are tracked separately rather than settled here.
     */
    facets: {
      eraBuckets: searchIndex.eraBuckets ?? [],
      keywords: searchIndex.keywords ?? [],
      researchCoverage: searchIndex.researchCoverage,
      recordMaturity: searchIndex.recordMaturity,
      confidenceTier: searchIndex.confidenceTier,
      topicIds: searchIndex.topicIds ?? [],
      mentionedEntityIds: searchIndex.mentionedEntityIds ?? [],
      notabilityBasis: searchIndex.notabilityBasis ?? [],
      notabilityLabels: searchIndex.notabilityLabels ?? [],
      /*
       * Omitted rather than written empty, for the same one-directional reason the backfill
       * gives: a record whose projection states no jurisdiction must not blank a facet that
       * some earlier pass got right. `ReleaseSearchIndexFields.jurisdictionState` is a required
       * string, so "absent" arrives here as `''`.
       */
      ...(searchIndex.jurisdictionState.trim().length > 0
        ? { jurisdictionState: searchIndex.jurisdictionState.trim() }
        : {}),
      ...(searchIndex.sensitivityClass !== undefined
        ? { sensitivityClass: searchIndex.sensitivityClass }
        : {}),
    },
  };
}

export function buildArtifactsForEntry(input: {
  readonly entry: ReleaseSourceEntity;
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly canonicalStatus?: CanonicalStatusSnapshot;
  /** See the matching field on `gateLandscapePublishCandidate`'s input. */
  readonly visitOverride?: PublicVisit;
  /** `gateLandscapePublishCandidate`'s `locationOverride` result, forwarded verbatim. */
  readonly locationOverride?: ReleaseLocationOverride;
}): PublishArtifactsResult {
  const build = buildReleaseEntityArtifacts(
    input.entry,
    buildContext({
      releaseId: input.releaseId,
      generatedAt: input.generatedAt,
      ...(input.canonicalStatus !== undefined ? { canonicalStatus: input.canonicalStatus } : {}),
      ...(input.visitOverride !== undefined ? { visitOverride: input.visitOverride } : {}),
      ...(input.locationOverride !== undefined ? { locationOverride: input.locationOverride } : {}),
    }),
  );
  if (!build.ok) {
    return { ok: false, reason: 'build_failed', detail: `${build.reason}: ${build.message}` };
  }
  const lintReport = lintBuiltProjection(input.entry, build.projection);
  if (lintReport.hasErrors) {
    const detail =
      lintReport.findings.find((finding) => finding.severity === 'error')?.message ??
      'publish status linter error';
    return { ok: false, reason: 'status_linter_error', detail, lintReport };
  }
  const entityRow = toReleaseEntityRow(build.projection);
  const searchRow = toSearchIndexRow(build.searchIndex, build.projection.location.geohash);
  return { ok: true, entityRow, searchRow, lintReport };
}

export type { PublishStatusLintReport };

export function incrementalPublishProvenancePatch(entityId: string): Record<string, unknown> {
  const at = new Date().toISOString();
  return {
    incremental_publish: at,
    incrementalPublishAt: at,
    publishedReleaseEntityId: entityId,
  };
}
