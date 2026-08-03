/**
 * Pure helpers for gated incremental upsert into bb_public.release_entities (+ search_index).
 * Used by publish-release-entities-incremental.ts and unit tests — no database I/O.
 */
import {
  US_STATES,
  buildReleaseEntityArtifacts,
  normalizeReleaseRelated,
  type CanonicalStatusSnapshot,
  type ReleaseEntityProjectionFields,
  type ReleaseSearchIndexFields,
  type ReleaseSourceClaim,
  type ReleaseSourceEntity,
  type StatusHistoryEntry,
  type EntityStatusValue,
} from '@repo/domain';
import { computeClaimConfidence } from '../lib/confidence.ts';
import { lintPublishStatus, type PublishStatusLintReport } from './publish-status-linter.ts';
import { buildNrhpListingFactObject, buildNrhpSignificanceObject } from './nrhp-area-labels.ts';

export const INCREMENTAL_PUBLISH_CONFIDENCE_FLOOR = 0.75;

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
  if (kind === 'publication' || kind === 'artifact') return 'work';
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
 * Person rows are blocked from incremental publish unless an operator has
 * recorded an explicit privacy review on the row: payload.personReview must
 * be an object with approved=true plus approvedBy/approvedAt/basis strings.
 * The marker is written manually (or by an operator-run script) after a human
 * confirms the person is a deceased historical figure — never by an agent.
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

export function jurisdictionFromProvenance(provenance: Readonly<Record<string, unknown>>): string {
  const city = typeof provenance.sourceCity === 'string' ? provenance.sourceCity : undefined;
  const stateCode =
    typeof provenance.sourceState === 'string' ? provenance.sourceState.toUpperCase() : undefined;
  if (stateCode === 'DC') return 'Washington, District of Columbia';
  if (city && stateCode) {
    const stateName = US_STATES[stateCode as keyof typeof US_STATES]?.name ?? stateCode;
    return `${city}, ${stateName}`;
  }
  if (stateCode) {
    return US_STATES[stateCode as keyof typeof US_STATES]?.name ?? stateCode;
  }
  return 'United States';
}

export function locationLabelFromProvenance(
  displayName: string,
  provenance: Readonly<Record<string, unknown>>,
): string {
  const historicAddress =
    typeof provenance.historicAddress === 'string' ? provenance.historicAddress.trim() : '';
  const city = typeof provenance.sourceCity === 'string' ? provenance.sourceCity : '';
  const state = typeof provenance.sourceState === 'string' ? provenance.sourceState : '';
  if (historicAddress.length > 0) {
    const suffix = [city, state].filter((part) => part.length > 0).join(', ');
    return suffix.length > 0 ? `${historicAddress}, ${suffix}` : historicAddress;
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
    const sources = [
      { url: claim.citationHref, textContainsSubjectName: true },
      ...corroborating.map((url) => ({ url, textContainsSubjectName: true })),
    ];
    const result = computeClaimConfidence(`${entry.id}-claim-${index}`, sources);
    min = Math.min(min, result.score);
  }
  return Number.isFinite(min) ? min : 0;
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
  // sharpened pin implying site-level accuracy the source data doesn't have.
  const geocode = asRecord(row.payload.geocode);
  const locationPrecision =
    typeof geocode.precision === 'string' && geocode.precision.trim().length > 0
      ? geocode.precision
      : 'site';

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
            confidenceLevel: 'high',
            citationSource: hostname,
            citationHref: canonicalUrl,
            citationLabel: hostname,
          },
          {
            predicate: 'significant for',
            object: buildNrhpSignificanceObject({
              areaOfSignificance:
                typeof row.payload.areaOfSignificance === 'string'
                  ? row.payload.areaOfSignificance
                  : undefined,
            }),
            confidenceLevel: 'high',
            citationSource: hostname,
            citationHref: canonicalUrl,
            citationLabel: hostname,
          },
        ]
      : [
          {
            predicate: 'documented_site',
            object: summary,
            confidenceLevel: 'high',
            citationSource: hostname,
            citationHref: canonicalUrl,
            citationLabel: hostname,
          },
        ];

  return {
    id: row.id,
    kind: row.kind,
    displayName,
    summary,
    ...(livingStatus !== undefined ? { livingStatus } : {}),
    jurisdictionLabel: jurisdictionFromProvenance(provenance),
    locationPrecision,
    locationLabel: locationLabelFromProvenance(displayName, provenance),
    lat: row.lat,
    lng: row.lng,
    claims,
    mentionedEntityIds: [],
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
  if (row.name_overlap) {
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
  // publicEntityProjectionSchema requires summary 120..400 chars; anything
  // outside that range would publish an unparseable (invisible) projection.
  if (entry.summary.length < 120 || entry.summary.length > 400) {
    return {
      eligible: false,
      reason: 'summary_too_short',
      detail: `summary length ${entry.summary.length} outside projection schema bounds 120..400`,
    };
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
    claims: projection.claims,
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
