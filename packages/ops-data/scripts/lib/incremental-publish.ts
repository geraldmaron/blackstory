/**
 * Pure helpers for gated incremental upsert into published.release_entities (+ search_index).
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
  type ReleaseBuildContext,
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
import {
  assessPublicationClaims,
  confidenceLevelForSource,
  type ReviewedClaimAssessment,
} from './confidence.ts';
import { lintPublishStatus, type PublishStatusLintReport } from './publish-status-linter.ts';
import { searchTopicsFromProjection } from './projection-divergence.ts';
import { cityStateFromJurisdictionLabel } from './evidence-collectors/subject-identity.ts';
import { buildNrhpListingFactObject, buildNrhpSignificanceObject } from './nrhp-area-labels.ts';

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
  /**
   * True when a validated enrichment draft differs from the staged summary. Undefined means the
   * caller did not load that information, not that no draft exists.
   */
  readonly enrichment_draft_unstaged?: boolean;
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
  | 'claim_assessment_required'
  /**
   * Republishing would reduce the existing claim set.
   */
  | 'claim_count_regression'
  /**
   * A standing withdrawal decision blocks publication and receives its own skip reason.
   */
  | 'catalog_decision_retracted';

export type PublishGateResult =
  | {
      readonly eligible: true;
      readonly entry: ReleaseSourceEntity;
      readonly reviewBasis: 'independent_review';
      /**
       * Location inherited from the public record. Forward the complete override to the final
       * build so matchMethod and precision remain attached to the correct point.
       */
      readonly locationOverride?: ReleaseLocationOverride;
    }
  | { readonly eligible: false; readonly reason: PublishGateSkipReason; readonly detail: string };

/**
 * Three columns, not fourteen.
 *
 * `display_name`, `kind`, `summary`, `location`, `geohash`, `lat`, `lng`, `claims`, `taxonomy`,
 * `related` and `primary_image` are now GENERATED ALWAYS from `projection` in the database
 * (supabase/migrations/..._release_entities_generated_from_projection.sql). Postgres refuses any
 * INSERT or UPDATE that supplies a value for a generated column, so writing them here is not
 * merely redundant, it fails.
 *
 * That is the point. Those eleven columns had drifted from the projection on 2,418 of 4,195 live
 * rows, always in the same direction — the copy behind, never ahead — because a write could land
 * on one store and not the other. Deriving them removes the possibility rather than scheduling
 * another repair.
 */
export type ReleaseEntityUpsertRow = {
  readonly release_id: string;
  readonly entity_id: string;
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
  readonly catalogDecision?: PublishCatalogDecision;
}) {
  return {
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
    ...(input.canonicalStatus !== undefined ? { canonicalStatus: input.canonicalStatus } : {}),
    ...(input.visitOverride !== undefined ? { visitOverride: input.visitOverride } : {}),
    ...(input.locationOverride !== undefined ? { locationOverride: input.locationOverride } : {}),
    ...(input.catalogDecision !== undefined ? { catalogDecision: input.catalogDecision } : {}),
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

/**
 * The retraction verdict the release builder's own gate reads, narrowed off `ReleaseBuildContext`
 * rather than restated here so the three action values cannot drift apart from the domain's.
 */
export type PublishCatalogDecision = NonNullable<ReleaseBuildContext['catalogDecision']>;

/** One `ops.catalog_decisions` row, as the publisher's lookup selects it. */
export type CatalogDecisionRow = {
  readonly entity_id: string;
  readonly decision: string;
  readonly reason: string | null;
};

/**
 * Parses the current per-entity catalog decision. A later clear_flag replaces the prior
 * withdrawal. The database constraint defines permitted decisions; unrecognized values return
 * undefined and therefore must be treated as a data-integrity concern by callers.
 */
export function catalogDecisionFromRow(
  row: CatalogDecisionRow | null | undefined,
): PublishCatalogDecision | undefined {
  if (!row) return undefined;
  const action = row.decision.trim();
  if (action !== 'flag_for_retraction' && action !== 'needs_review' && action !== 'clear_flag') {
    return undefined;
  }
  return { action, reason: row.reason?.trim() ?? '' };
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
 * (`canonical.entity_visit` + the first non-empty `canonical.entity_locations` row for the
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
 * Uses the shared city/state label parser for visit derivation and publication.
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
 * `research.landscape_candidates` alone, which carries no visit data at all — `entry.visit`
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
 * Place-like records may use their own name as a location label. Other kinds prefer sourced
 * place fields. The display-name fallback is only a buildability fallback and must not be
 * interpreted as geographic evidence.
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

  // Separate the NRHP listing fact from its significance claim. A candidate without a registry
  // URL gets no record_index claim and must rely on its actual cited evidence.
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
              // Describe what the source states in the predicate. Do not encode the desired
              // inclusion criterion there and then infer that same criterion from the generated
              // label.
              predicate: 'source states',
              object: summary,
              confidenceLevel: confidenceLevelForSource(canonicalUrl),
              citationSource: hostname,
              citationHref: canonicalUrl,
              citationLabel: hostname,
              claimRole: 'record_index',
            },
          ];

  // Preserve quotations from documents used by enrichment. Group citations by document and
  // merge distinct quotations without counting repeated excerpts as independent sources. The
  // subsequent reviewed-claim gate establishes publication eligibility.
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
      // Initial source-kind grade only. Publication replaces it with the current independently
      // reviewed claim assessment.
      confidenceLevel: confidenceLevelForSource(sourceUrl),
      citationSource: evidenceHost,
      citationHref: sourceUrl,
      citationLabel: label,
      claimRole: 'evidence',
    });
  }
  claims.push(...evidenceClaims);

  // Reject a record whose citations all disappear during URL validation and document merging.
  // The earlier payload precheck does not prove a usable claim remains.
  if (claims.length === 0) return null;

  // Enrichment writes its long-form prose back onto the landscape row; without this passthrough
  // the builder would rebuild the entity from index fields alone and silently drop it, so a
  // researched record would republish as thin as it started.
  const enrichedContext =
    typeof row.payload.historicalContext === 'string' ? row.payload.historicalContext.trim() : '';
  // Carry narrative and taxonomy fields through to publication. The release builder revalidates
  // controlled topic ids; impact statements must reach the projection used by content checks.
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
 * Reconstructs only summary, historicalContext and claims from the live row for the shared
 * depth evaluator.
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
        ...(typeof claim.archivedUrl === 'string' && claim.archivedUrl.length > 0
          ? { archivedUrl: claim.archivedUrl }
          : {}),
        ...(typeof claim.archivedAt === 'string' && claim.archivedAt.length > 0
          ? { archivedAt: claim.archivedAt }
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
  // Use ASCII Unit Separator for this in-memory identity key. Literal NUL bytes cause text
  // tooling to classify the module as binary.
  return `${claim.predicate.trim().toLowerCase()}\u001f${claim.object.trim().toLowerCase()}`;
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
 * Reads location from the live public projection. Returns undefined unless both coordinates are
 * finite; the caller cannot inherit an absent point.
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
 * Inherit coordinates, precision and matchMethod together from the public record when the
 * candidate has no point. Prefer sourced candidate location prose when available, otherwise
 * retain published labels.
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

  // The registry URL identifies listing-only evidence. A curated record without one must not
  // have an arbitrary evidence URL substituted into that role. Different documents still
  // require lineage review before being treated as independent.
  const registryDocument = documentKey(row.canonical_url);
  const claims = entry.claims ?? [];
  const hasIndependentSource = claims.some((claim) => {
    const key = documentKey(claim.citationHref);
    return key !== null && key !== registryDocument;
  });
  if (hasIndependentSource) return { deep: true };

  // Report a newer unstaged draft explicitly. That changes the remediation message, not
  // publication eligibility or the staging review step.
  const staleDraftSuffix = row.enrichment_draft_unstaged
    ? ' — an enrichment draft exists for this record but has not been staged onto it; run apply-enrichment-to-landscape.ts'
    : '';

  const summary = entry.summary;
  const signature = findTemplateSummarySignature(summary);
  if (signature !== null) {
    return {
      deep: false,
      detail: `summary carries a generated-template signature ("${signature.slice(0, 48)}…")${staleDraftSuffix}`,
    };
  }

  const normalizedSummary = normalizeProse(summary);
  const echoed = claims.filter((claim) => normalizeProse(claim.object) === normalizedSummary);
  if (echoed.length === claims.length && claims.length > 0) {
    return {
      deep: false,
      detail: `every claim restates the summary verbatim — no fact beyond the registry listing${staleDraftSuffix}`,
    };
  }

  return {
    deep: false,
    detail: `no evidence beyond the registry index row (${registryDocument ?? 'unknown source'})${staleDraftSuffix}`,
  };
}

export function gateLandscapePublishCandidate(input: {
  readonly row: LandscapePublishRow;
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly canonicalStatus?: CanonicalStatusSnapshot;
  /**
   * Allows rebuilding an already-published entity id instead of treating it as duplicate
   * admission. Privacy, claim assessment, withdrawal and content gates still apply.
   */
  readonly allowRepublish?: boolean;
  /**
   * Current published depth enables a non-regression comparison. Without loaded live state,
   * strict admission requirements apply.
   */
  readonly liveDepth?: DepthAssessment;
  /** Loaded from the canonical ledger, separately from candidate/model payloads. */
  readonly reviewedClaims?: readonly ReviewedClaimAssessment[];
  /**
   * Public location available for an explicit republish whose candidate lacks coordinates.
   * Omitting it does not invent a location.
   */
  readonly liveLocation?: LiveLocationInheritance;
  /**
   * Raw (pre-gating) visit-contact input from `canonical.entity_visit` +
   * `entity_locations.street`/`postal_code`, when the caller looked one up for this entity
   * (`visitOverrideFromCanonicalRow`). Wins over whatever `buildReleaseSourceFromLandscape`
   * derived from the landscape row (normally nothing — the landscape payload carries no visit
   * data) and is gated through `publicVisitForTier` inside `buildReleaseEntityArtifacts`, same
   * precedence as `canonicalStatus` above. Omitting it leaves that empty derivation in force,
   * which is how a republish silently dropped a backfilled phone/website/street before this was
   * wired in.
   */
  readonly visitOverride?: PublicVisit;
  /**
   * Current catalog decision, loaded for every candidate. A withdrawal must survive deletion of
   * the public row and block later reconstruction from retained research. Forward the decision
   * to the release builder as well as the early skip check.
   */
  readonly catalogDecision?: PublishCatalogDecision;
}): PublishGateResult {
  const row = input.row;

  /*
   * Answered first, ahead of every editorial check below.
   *
   * `buildReleaseEntityArtifacts` is still the authority on this rule and refuses the record on
   * its own at the bottom of this function — this is a short-circuit for ORDER, not a second
   * implementation, and if the two ever disagree the build's verdict is the one that decides
   * whether a row gets written. Order matters for two reasons. A withdrawn record that also has,
   * say, a short summary would otherwise be reported as `summary_too_short`, which reads as "fix
   * the summary and it publishes" when the truth is that it must not publish at any summary
   * length. And the run report's `retractedIds` would undercount, so the one line that says which
   * withdrawals held on this run could not be trusted.
   */
  if (input.catalogDecision?.action === 'flag_for_retraction') {
    return {
      eligible: false,
      reason: 'catalog_decision_retracted',
      detail: `withdrawn by catalog decision: ${input.catalogDecision.reason}`,
    };
  }

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
  // Declared here, above the first of the four checks that ask the ADMISSION vs REGRESSION
  // question: location, depth, confidence, and the name-collision hold that now runs last.
  const republishingLiveRow = input.allowRepublish === true && row.exact_in_release === true;

  /*
   * New records require a usable location on this publication path. Explicit republishing may
   * retain the existing record's point and its precision/provenance when staging lacks
   * coordinates. This exception does not waive reviewed-claim confidence requirements.
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
  let entry = inherited?.entry ?? builtEntry;
  const locationOverride = inherited?.locationOverride;
  // Uses the enrichment module's shared summary bounds. Short best-effort drafts remain flagged
  // in the ledger but this publication gate does not automatically admit them.
  if (entry.summary.length < SUMMARY_MIN_CHARS || entry.summary.length > SUMMARY_MAX_CHARS) {
    return {
      eligible: false,
      reason: 'summary_too_short',
      detail:
        `summary length ${entry.summary.length} outside enrichment bounds ` +
        `${SUMMARY_MIN_CHARS}..${SUMMARY_MAX_CHARS}`,
    };
  }

  // New admission requires depth. Republishing compares candidate and current content so a
  // shallow correction can replace an already-shallow record, while a deep record cannot become
  // shallow. Template disclosures and reviewed-claim requirements remain independent gates.
  const depth = assessLandscapeDepth(entry, row);
  if (!depth.deep) {
    const liveIsShallow = input.liveDepth !== undefined && !input.liveDepth.deep;
    if (!republishingLiveRow || !liveIsShallow) {
      return { eligible: false, reason: 'template_only', detail: depth.detail };
    }
  }

  const assessment = assessPublicationClaims(entry, input.reviewedClaims ?? []);
  if (!assessment.ok) {
    return { eligible: false, reason: 'claim_assessment_required', detail: assessment.detail };
  }
  entry = { ...entry, claims: assessment.claims };

  const build = buildReleaseEntityArtifacts(
    entry,
    buildContext({
      releaseId: input.releaseId,
      generatedAt: input.generatedAt,
      ...(input.canonicalStatus !== undefined ? { canonicalStatus: input.canonicalStatus } : {}),
      ...(input.visitOverride !== undefined ? { visitOverride: input.visitOverride } : {}),
      ...(locationOverride !== undefined ? { locationOverride } : {}),
      ...(input.catalogDecision !== undefined ? { catalogDecision: input.catalogDecision } : {}),
    }),
  );
  if (!build.ok) {
    // The withdrawal ruling gets its own skip reason instead of the generic `build_failed`, so
    // a run report counts it separately and an operator can see at a glance that a retraction
    // held. The rule that produced it still lives in one place, the release builder.
    if (build.reason === 'catalog_decision_retracted') {
      return { eligible: false, reason: 'catalog_decision_retracted', detail: build.message };
    }
    return {
      eligible: false,
      reason: 'build_failed',
      detail: `${build.reason}: ${build.message}`,
    };
  }

  /*
   * Check name collisions after actionable content and location failures. New admission blocks
   * a collision; correcting an already-published entity does not create a second record. This
   * changes collision handling, not how the overlap is detected.
   */
  if (row.name_overlap && !republishingLiveRow) {
    return {
      eligible: false,
      reason: 'name_overlap',
      detail: 'display_name overlaps existing release entity',
    };
  }

  return {
    eligible: true,
    entry,
    reviewBasis: assessment.reviewBasis,
    ...(locationOverride !== undefined ? { locationOverride } : {}),
  };
}

export function toReleaseEntityRow(
  projection: ReleaseEntityProjectionFields,
): ReleaseEntityUpsertRow {
  /*
   * Normalize claims and related arrays inside projection before writing. Generated columns and
   * public readers must derive from the same normalized representation.
   */
  const related = normalizeReleaseRelated(projection.related);
  const claims = normalizeReleaseClaims(projection.claims);
  return {
    release_id: projection.releaseId,
    entity_id: projection.id,
    projection: { ...projection, claims, related },
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
     * Use nonempty topicTags, otherwise topicIds. Share that rule with the audit and realigner;
     * an empty array is not nullish.
     */
    topics: [...searchTopicsFromProjection(searchIndex)],
    kind: searchIndex.kind,
    status: searchIndex.status ?? null,
    geohash,
    related_count: searchIndex.relatedCount ?? 0,
    claim_count: searchIndex.claimCount ?? 0,
    /**
     * Carries every search field whose reader depends on facets. Upserts replace the whole
     * facets object, so omitted keys are deleted. Columns own fields such as name, kind and
     * status; keep projection-only facet fields complete without creating conflicting copies.
     */
    facets: {
      eraBuckets: searchIndex.eraBuckets ?? [],
      keywords: searchIndex.keywords ?? [],
      researchCoverage: searchIndex.researchCoverage,
      recordMaturity: searchIndex.recordMaturity,
      evidenceInputs: searchIndex.evidenceInputs,
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
  /**
   * See the matching field on `gateLandscapePublishCandidate`'s input. Forwarded here as well
   * because this, not the gate, is the call that produces the rows the publisher upserts: the
   * gate's build is a probe, and a caller that reached this function by some other route must
   * still not be able to write a withdrawn record back into the release.
   */
  readonly catalogDecision?: PublishCatalogDecision;
}): PublishArtifactsResult {
  const build = buildReleaseEntityArtifacts(
    input.entry,
    buildContext({
      releaseId: input.releaseId,
      generatedAt: input.generatedAt,
      ...(input.canonicalStatus !== undefined ? { canonicalStatus: input.canonicalStatus } : {}),
      ...(input.visitOverride !== undefined ? { visitOverride: input.visitOverride } : {}),
      ...(input.locationOverride !== undefined ? { locationOverride: input.locationOverride } : {}),
      ...(input.catalogDecision !== undefined ? { catalogDecision: input.catalogDecision } : {}),
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
