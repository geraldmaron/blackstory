/**
 * Pure helpers for gated incremental upsert into bb_public.release_entities (+ search_index).
 * Used by publish-release-entities-incremental.ts and unit tests — no database I/O.
 */
import {
  US_STATES,
  buildReleaseEntityArtifacts,
  normalizeReleaseClaims,
  normalizeReleaseRelated,
  type CanonicalStatusSnapshot,
  type ReleaseEntityProjectionFields,
  type ReleaseSearchIndexFields,
  type ReleaseSourceClaim,
  type ReleaseSourceEntity,
  type StatusHistoryEntry,
  type EntityStatusValue,
  findTemplateSummarySignature,
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
  const evidenceClaims: ReleaseSourceClaim[] = [];
  const seenEvidenceDocuments = new Set([documentKey(canonicalUrl)].filter(Boolean) as string[]);
  for (const raw of asRecordArray(row.payload.evidenceCitations)) {
    const sourceUrl = typeof raw.sourceUrl === 'string' ? raw.sourceUrl.trim() : '';
    const quote = typeof raw.quote === 'string' ? raw.quote.trim() : '';
    if (sourceUrl.length === 0 || quote.length === 0) continue;
    const key = documentKey(sourceUrl);
    if (key === null || seenEvidenceDocuments.has(key)) continue;
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
    evidenceClaims.push({
      predicate: 'source states',
      object: quote,
      // tier2 (Wikipedia and similar) is corroborating, not authoritative; tier1 (the nomination
      // form, a government record) is. Publishing both at 'high' would erase that distinction in
      // the confidence floor and in what a reader is told about the evidence.
      confidenceLevel: raw.sourceTier === 'tier1' ? 'high' : 'medium',
      citationSource: evidenceHost,
      citationHref: sourceUrl,
      citationLabel: label,
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
  const enrichedTopicIds = asStringArray(row.payload.topicIds);
  const enrichedEraBuckets = asStringArray(row.payload.eraBuckets);
  const enrichedKeywords = asStringArray(row.payload.keywords);

  return {
    id: row.id,
    kind: row.kind,
    displayName,
    summary,
    ...(enrichedContext.length > 0 ? { historicalContext: enrichedContext } : {}),
    ...(enrichedTopicIds.length > 0 ? { topicIds: enrichedTopicIds } : {}),
    ...(enrichedEraBuckets.length > 0 ? { eraBuckets: enrichedEraBuckets } : {}),
    ...(enrichedKeywords.length > 0 ? { keywords: enrichedKeywords } : {}),
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
  // publicEntityProjectionSchema requires summary 120..400 chars; anything
  // outside that range would publish an unparseable (invisible) projection.
  if (entry.summary.length < 120 || entry.summary.length > 400) {
    return {
      eligible: false,
      reason: 'summary_too_short',
      detail: `summary length ${entry.summary.length} outside projection schema bounds 120..400`,
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
