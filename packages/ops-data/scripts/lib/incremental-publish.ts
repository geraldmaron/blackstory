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
  type ReleaseEntityProjectionFields,
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
  | 'confidence_below_floor';

export type PublishGateResult =
  | { readonly eligible: true; readonly entry: ReleaseSourceEntity; readonly confidence: number }
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
}) {
  return {
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
    ...(input.canonicalStatus !== undefined ? { canonicalStatus: input.canonicalStatus } : {}),
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
  if (row.canonical_url) urls.delete(row.canonical_url);
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
  if (displayName.length === 0 || summary.length === 0 || canonicalUrl.length === 0) return null;
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
  const claims: ReleaseSourceClaim[] =
    row.lane === 'nrhp-black-heritage'
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
    mentionedEntityIds: [],
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
  if (row.lat === null || row.lng === null) {
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
  const republishingLiveRow = input.allowRepublish === true && row.exact_in_release === true;
  if (row.name_overlap && !republishingLiveRow) {
    return {
      eligible: false,
      reason: 'name_overlap',
      detail: 'display_name overlaps existing release entity',
    };
  }

  const entry = buildReleaseSourceFromLandscape(row);
  if (!entry) {
    return {
      eligible: false,
      reason: 'missing_canonical_url',
      detail: 'insufficient landscape fields to build release source',
    };
  }
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
    return {
      eligible: false,
      reason: 'confidence_below_floor',
      detail: `confidence ${confidence.toFixed(3)} < floor ${floor}`,
    };
  }

  const build = buildReleaseEntityArtifacts(
    entry,
    buildContext({
      releaseId: input.releaseId,
      generatedAt: input.generatedAt,
      ...(input.canonicalStatus !== undefined ? { canonicalStatus: input.canonicalStatus } : {}),
    }),
  );
  if (!build.ok) {
    return {
      eligible: false,
      reason: 'build_failed',
      detail: `${build.reason}: ${build.message}`,
    };
  }

  return { eligible: true, entry, confidence };
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
    topics: searchIndex.topicTags ?? searchIndex.topicIds ?? [],
    kind: searchIndex.kind,
    status: searchIndex.status ?? null,
    geohash,
    related_count: searchIndex.relatedCount ?? 0,
    claim_count: searchIndex.claimCount ?? 0,
    facets: {
      eraBuckets: searchIndex.eraBuckets ?? [],
      keywords: searchIndex.keywords ?? [],
      researchCoverage: searchIndex.researchCoverage,
      recordMaturity: searchIndex.recordMaturity,
      confidenceTier: searchIndex.confidenceTier,
    },
  };
}

export function buildArtifactsForEntry(input: {
  readonly entry: ReleaseSourceEntity;
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly canonicalStatus?: CanonicalStatusSnapshot;
}): PublishArtifactsResult {
  const build = buildReleaseEntityArtifacts(
    input.entry,
    buildContext({
      releaseId: input.releaseId,
      generatedAt: input.generatedAt,
      ...(input.canonicalStatus !== undefined ? { canonicalStatus: input.canonicalStatus } : {}),
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
