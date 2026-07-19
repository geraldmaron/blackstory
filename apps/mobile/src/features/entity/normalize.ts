/**
 * Defensive runtime normalization from `unknown` JSON into the vendored `Entity` shape
 * (MOB-014).
 *
 * WHY THIS EXISTS: `apps/mobile`'s data layer (MOB-009, `data/contracts.ts`) deliberately does
 * NOT re-run zod validation client-side — it treats entity bodies as opaque JSON and relies on
 * `apps/api-public`'s server-side `entityV1Schema.safeParse` as the enforcement point. That is
 * correct for the cache layer, but a RENDERING layer cannot inherit that trust blindly: a
 * corrupted cache row, a future contract-drift bug, or (defense in depth) a compromised/rooted
 * client rewriting its own SQLite cache (threat-model T1 — "nothing of value is stored
 * on-device" also means nothing here should be able to crash the app if that on-device row is
 * tampered with) all mean this screen must tolerate arbitrary malformed input without ever
 * throwing.
 *
 * Every `normalize*` function below is total: for any `unknown` input it returns either a
 * value with the documented shape, or (for optional sub-objects) `undefined` — it never throws
 * and never returns a partially-typed object cast with `as`. Invalid array ELEMENTS are dropped
 * rather than aborting the whole array (one bad claim must not hide every other claim). Invalid
 * REQUIRED leaf strings fall back to `''` (rendered sections simply hide themselves when empty
 * — see EntityDetailScreen.tsx) rather than aborting the whole entity, except for the two
 * fields (`id`, `displayName`) with no sane fallback, where the entity is rejected entirely
 * (the caller shows the generic error state, never a half-rendered screen).
 *
 * Defensive posture on enums: an unrecognized enum value never fails OPEN toward the most
 * permissive/dangerous option. Confidence defaults to `'low'` (not `'high'`), a media object
 * with an unrecognized `rightsStatus` is DROPPED entirely (not rendered — a placeholder shows
 * instead, matching "rights not cleared" handling), and an unrecognized `datePrecision` defaults
 * to `'circa'` (the LEAST precise value) so a malformed payload can never imply more precision
 * than the data actually supports.
 */
import {
  CONFIDENCE_LEVELS,
  DATE_PRECISIONS,
  DISPUTE_ALTERNATE_KINDS,
  MAX_BASIS_CLAIM_IDS,
  MAX_CLAIMS,
  MAX_CLAIM_REVISION_HISTORY,
  MAX_CONTINUE_LEARNING,
  MAX_DISPUTE_ALTERNATES,
  MAX_ERA_BUCKETS,
  MAX_EXTENDED_NARRATIVE_CHARS,
  MAX_LONG_TEXT,
  MAX_NOTABILITY_BASIS,
  MAX_NOTABILITY_LABELS,
  MAX_NOTE_TEXT,
  MAX_RELATED_ENTRIES,
  MAX_RELATED_NEIGHBORS,
  MAX_SHORT_TEXT,
  MAX_STATUS_HISTORY,
  MAX_SUMMARY_CHARS,
  MAX_TIMELINE_EVENTS,
  MAX_TOPIC_IDS,
  MAX_TOPIC_TAGS,
  MEDIA_RIGHTS_STATUSES,
  RELATION_DIRECTIONS,
  REVISION_CHANGE_KINDS,
  type Claim,
  type ClaimDispute,
  type ClaimDisputeAlternate,
  type ClaimRetraction,
  type ClaimRevisionEntry,
  type Citation,
  type ConfidenceLevel,
  type DatePrecision,
  type Entity,
  type EntitySensitivity,
  type EventWindow,
  type GeoAnchor,
  type Media,
  type NotabilityBasisEntry,
  type RelatedEntry,
  type RelatedNeighbor,
  type RelationTimespan,
  type RevisionMetadata,
  type StatusHistoryEntry,
  type TimelineEvent,
} from './types';
import { isSafeExternalUrl } from './linking';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, maxLength: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.length > maxLength ? value.slice(0, maxLength) : value;
  return trimmed;
}

function optionalStr(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/** Like `optionalStr` but also accepts an explicit `null` passthrough (several wire fields are
 * `string | null | undefined`, e.g. `validTo`/`endAt` meaning "open-ended", not "unknown"). */
function optionalStrOrNull(value: unknown, maxLength: number): string | null | undefined {
  if (value === null) return null;
  return optionalStr(value, maxLength);
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function boundedStrArray(value: unknown, maxItems: number, maxLength: number): readonly string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (out.length >= maxItems) break;
    if (typeof item === 'string' && item.length > 0) out.push(str(item, maxLength));
  }
  return out;
}

function enumOr<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function datePrecisionOr(value: unknown, fallback: DatePrecision = 'circa'): DatePrecision {
  return enumOr(value, DATE_PRECISIONS, fallback);
}

// ---------------------------------------------------------------------------
// Citation / dispute / retraction / revision-entry (claim.ts / citation.ts)
// ---------------------------------------------------------------------------

export function normalizeCitation(value: unknown): Citation | undefined {
  if (!isObject(value)) return undefined;
  const source = str(value.source, MAX_SHORT_TEXT, 'Unknown source');
  const label = str(value.label, MAX_SHORT_TEXT, 'Source unavailable');
  const rawHref = optionalStr(value.href, 2000);
  // Defense in depth (independent of the server's own httpUrl bound): never surface a link the
  // client's own allowlist rejects, even if it slipped through as a string.
  const href = rawHref && isSafeExternalUrl(rawHref) ? rawHref : undefined;
  const withheldReason = optionalStr(value.withheldReason, 500);
  return { source, label, ...(href ? { href } : {}), ...(withheldReason ? { withheldReason } : {}) };
}

function normalizeDisputeAlternate(value: unknown): ClaimDisputeAlternate | null {
  if (!isObject(value)) return null;
  const rawValue = optionalStr(value.value, MAX_NOTE_TEXT);
  if (!rawValue) return null;
  return {
    value: rawValue,
    credible: value.credible === true,
    kind: enumOr(value.kind, DISPUTE_ALTERNATE_KINDS, 'alternative'),
  };
}

export function normalizeDispute(value: unknown): ClaimDispute | undefined {
  if (!isObject(value)) return undefined;
  const primaryValue = optionalStr(value.primaryValue, MAX_NOTE_TEXT);
  if (!primaryValue) return undefined;
  const alternates: ClaimDisputeAlternate[] = [];
  if (Array.isArray(value.alternates)) {
    for (const raw of value.alternates) {
      if (alternates.length >= MAX_DISPUTE_ALTERNATES) break;
      const alt = normalizeDisputeAlternate(raw);
      if (alt) alternates.push(alt);
    }
  }
  const note = optionalStr(value.note, MAX_NOTE_TEXT);
  return {
    hasDispute: value.hasDispute === true || alternates.length > 0,
    primaryValue,
    ...(note ? { note } : {}),
    alternates,
  };
}

function normalizeRevisionEntry(value: unknown): ClaimRevisionEntry | null {
  if (!isObject(value)) return null;
  const id = optionalStr(value.id, 200);
  const summary = optionalStr(value.summary, MAX_NOTE_TEXT);
  if (!id || !summary) return null;
  return {
    id,
    changedAt: str(value.changedAt, 64),
    changeKind: enumOr(value.changeKind, REVISION_CHANGE_KINDS, 'revised'),
    summary,
    ...(optionalStr(value.policyVersion, 100) ? { policyVersion: optionalStr(value.policyVersion, 100) } : {}),
  };
}

function normalizeRetraction(value: unknown): ClaimRetraction | undefined {
  if (!isObject(value)) return undefined;
  const reason = optionalStr(value.reason, MAX_NOTE_TEXT);
  if (!reason) return undefined;
  const supersededByClaimId = optionalStr(value.supersededByClaimId, 200);
  return {
    retractedAt: str(value.retractedAt, 64),
    reason,
    ...(supersededByClaimId ? { supersededByClaimId } : {}),
  };
}

export function normalizeClaim(value: unknown): Claim | null {
  if (!isObject(value)) return null;
  const id = optionalStr(value.id, 200);
  const object = optionalStr(value.object, MAX_LONG_TEXT);
  // Neither has a sane fallback — a claim with no body text isn't renderable as a claim.
  if (!id || !object) return null;

  const score = num(value.confidenceScore);
  const confidenceScore = score === undefined ? 0 : Math.min(1, Math.max(0, score));
  // Fail toward the LEAST reassuring label on malformed data, never the most.
  const confidenceLevel: ConfidenceLevel = enumOr(value.confidenceLevel, CONFIDENCE_LEVELS, 'low');

  const revisionHistory: ClaimRevisionEntry[] = [];
  if (Array.isArray(value.revisionHistory)) {
    for (const raw of value.revisionHistory) {
      if (revisionHistory.length >= MAX_CLAIM_REVISION_HISTORY) break;
      const entry = normalizeRevisionEntry(raw);
      if (entry) revisionHistory.push(entry);
    }
  }

  const lineageCount = num(value.independentLineageCount);

  return {
    id,
    predicate: str(value.predicate, MAX_SHORT_TEXT, 'Claim'),
    object,
    confidenceScore,
    confidenceLevel,
    ...(normalizeCitation(value.citation) ? { citation: normalizeCitation(value.citation) } : {}),
    ...(lineageCount !== undefined ? { independentLineageCount: Math.max(0, Math.trunc(lineageCount)) } : {}),
    ...(normalizeDispute(value.dispute) ? { dispute: normalizeDispute(value.dispute) } : {}),
    ...(revisionHistory.length > 0 ? { revisionHistory } : {}),
    ...(normalizeRetraction(value.retraction) ? { retraction: normalizeRetraction(value.retraction) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Timeline (timeline.ts)
// ---------------------------------------------------------------------------

export function normalizeTimelineEvent(value: unknown): TimelineEvent | null {
  if (!isObject(value)) return null;
  const id = optionalStr(value.id, 200);
  const title = optionalStr(value.title, MAX_SHORT_TEXT);
  if (!id || !title) return null;
  // `at` is a machine-parseable ISO timestamp when known — never fabricated when absent or
  // unparseable (adversarial: an invalid date string must not surface as a fake precise date).
  const rawAt = optionalStr(value.at, 64);
  const at = rawAt && !Number.isNaN(Date.parse(rawAt)) ? rawAt : undefined;
  return {
    id,
    atLabel: str(value.atLabel, 120, 'Undated'),
    ...(at ? { at } : {}),
    datePrecision: datePrecisionOr(value.datePrecision),
    title,
    body: str(value.body, MAX_LONG_TEXT, ''),
  };
}

// ---------------------------------------------------------------------------
// Revision (revision.ts)
// ---------------------------------------------------------------------------

export function normalizeRevision(value: unknown): RevisionMetadata {
  if (!isObject(value)) return { releaseId: '', generatedAt: '', recordUpdatedAt: '' };
  return {
    releaseId: str(value.releaseId, 200, ''),
    generatedAt: str(value.generatedAt, 64, ''),
    recordUpdatedAt: str(value.recordUpdatedAt, 64, ''),
  };
}

// ---------------------------------------------------------------------------
// Media (media.ts)
// ---------------------------------------------------------------------------

/**
 * Returns `undefined` (⇒ placeholder shown) whenever the rights signal is missing, malformed,
 * or not one of the three cleared statuses the wire schema defines
 * (`public_domain`/`licensed`/`fair_use`). There is no "withheld" wire value by construction —
 * the server simply omits `primaryImage` when rights aren't cleared — so an object that DOES
 * carry an unrecognized `rightsStatus` (e.g. a corrupted cache row, or a hostile/malformed
 * response) is treated exactly like "rights not cleared": FAIL CLOSED, never render.
 */
export function normalizeMedia(value: unknown): Media | undefined {
  if (!isObject(value)) return undefined;
  const url = optionalStr(value.url, 2000);
  const rightsStatusRaw = value.rightsStatus;
  const rightsStatusValid = typeof rightsStatusRaw === 'string' && (MEDIA_RIGHTS_STATUSES as readonly string[]).includes(rightsStatusRaw);
  if (!url || !isSafeExternalUrl(url) || !rightsStatusValid) return undefined;

  const alt = optionalStr(value.alt, 500) ?? 'Untitled image';
  const credit = optionalStr(value.credit, 500) ?? '';
  const width = num(value.width);
  const height = num(value.height);
  const objectPath = optionalStr(value.objectPath, 1000);

  return {
    url,
    alt,
    credit,
    rightsStatus: rightsStatusRaw as Media['rightsStatus'],
    ...(width !== undefined && width > 0 ? { width: Math.trunc(width) } : {}),
    ...(height !== undefined && height > 0 ? { height: Math.trunc(height) } : {}),
    ...(objectPath ? { objectPath } : {}),
  };
}

// ---------------------------------------------------------------------------
// Related (related.ts)
// ---------------------------------------------------------------------------

function normalizeTimespan(value: unknown): RelationTimespan | undefined {
  if (!isObject(value)) return undefined;
  const label = optionalStr(value.label, 200);
  const validFrom = optionalStr(value.validFrom, 64);
  const validTo = optionalStrOrNull(value.validTo, 64);
  if (label === undefined && validFrom === undefined && validTo === undefined) return undefined;
  return {
    ...(label !== undefined ? { label } : {}),
    ...(validFrom !== undefined ? { validFrom } : {}),
    ...(validTo !== undefined ? { validTo } : {}),
  };
}

export function normalizeRelatedEntry(value: unknown): RelatedEntry | null {
  if (!isObject(value)) return null;
  const id = optionalStr(value.id, 200);
  if (!id) return null;
  return {
    id,
    type: str(value.type, 100, 'related'),
    direction: enumOr(value.direction, RELATION_DIRECTIONS, 'outgoing'),
    ...(normalizeTimespan(value.timespan) ? { timespan: normalizeTimespan(value.timespan) } : {}),
  };
}

/**
 * `id` is the only thing required; a self-referencing neighbor (its own id) or a neighbor that
 * repeats a sibling's id is still normalized and rendered flatly — this function performs no
 * graph traversal or de-duplication across neighbors of ITS OWN, so there is structurally no
 * recursive expansion path here to loop on (defense in depth beyond public-contracts' own
 * "never recursive" schema guarantee — see EntityDetailScreen tests for the cyclic-reference
 * case).
 */
export function normalizeRelatedNeighbor(value: unknown): RelatedNeighbor | null {
  if (!isObject(value)) return null;
  const id = optionalStr(value.id, 200);
  if (!id) return null;
  return {
    id,
    displayName: str(value.displayName, MAX_SHORT_TEXT, id),
    kind: str(value.kind, 100, 'record'),
    summary: str(value.summary, 2000, ''),
    relationType: str(value.relationType, 100, 'related'),
    direction: enumOr(value.direction, RELATION_DIRECTIONS, 'outgoing'),
    ...(normalizeTimespan(value.timespan) ? { timespan: normalizeTimespan(value.timespan) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Entity-level sub-objects (entity.ts)
// ---------------------------------------------------------------------------

function normalizeStatusHistoryEntry(value: unknown): StatusHistoryEntry | null {
  if (!isObject(value)) return null;
  const status = optionalStr(value.status, 100);
  if (!status) return null;
  return {
    status,
    ...(optionalStr(value.validFrom, 64) !== undefined ? { validFrom: optionalStr(value.validFrom, 64) } : {}),
    ...(optionalStrOrNull(value.validTo, 64) !== undefined ? { validTo: optionalStrOrNull(value.validTo, 64) } : {}),
    datePrecision: datePrecisionOr(value.datePrecision),
    basisClaimIds: boundedStrArray(value.basisClaimIds, MAX_BASIS_CLAIM_IDS, 200),
  };
}

function normalizeEventWindow(value: unknown): EventWindow | undefined {
  if (!isObject(value)) return undefined;
  return {
    ...(optionalStr(value.startAt, 64) !== undefined ? { startAt: optionalStr(value.startAt, 64) } : {}),
    ...(optionalStrOrNull(value.endAt, 64) !== undefined ? { endAt: optionalStrOrNull(value.endAt, 64) } : {}),
    datePrecision: datePrecisionOr(value.datePrecision),
    ...(optionalStr(value.eventType, 100) !== undefined ? { eventType: optionalStr(value.eventType, 100) } : {}),
  };
}

function normalizeSensitivity(value: unknown): EntitySensitivity | undefined {
  if (!isObject(value)) return undefined;
  const cls = optionalStr(value.class, 100);
  const note = optionalStr(value.note, 2000);
  if (!cls || !note) return undefined;
  return { class: cls, note, basisClaimIds: boundedStrArray(value.basisClaimIds, MAX_BASIS_CLAIM_IDS, 200) };
}

function normalizeNotabilityBasisEntry(value: unknown): NotabilityBasisEntry | null {
  if (!isObject(value)) return null;
  const criterion = optionalStr(value.criterion, 100);
  const note = optionalStr(value.note, 2000);
  if (!criterion || !note) return null;
  return { criterion, note, evidenceIds: boundedStrArray(value.evidenceIds, MAX_BASIS_CLAIM_IDS, 200) };
}

function normalizeGeoAnchor(value: unknown): GeoAnchor | undefined {
  if (!isObject(value)) return undefined;
  const lat = num(value.lat);
  const lng = num(value.lng);
  if (lat === undefined || lng === undefined || lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return { lat, lng, geohash: str(value.geohash, 20, ''), matchMethod: str(value.matchMethod, 100, '') };
}

// ---------------------------------------------------------------------------
// Entity (entity.ts) — top level
// ---------------------------------------------------------------------------

/**
 * Normalizes an arbitrary JSON value into an `Entity`, or returns `null` if the value is
 * missing the two fields with no sane rendering fallback (`id`, `displayName`). Every other
 * field degrades gracefully — see the module header for the full defensive-posture rationale.
 */
export function normalizeEntity(value: unknown): Entity | null {
  if (!isObject(value)) return null;
  const id = optionalStr(value.id, 200);
  const displayName = optionalStr(value.displayName, MAX_SHORT_TEXT);
  if (!id || !displayName) return null;

  const claims: Claim[] = [];
  if (Array.isArray(value.claims)) {
    for (const raw of value.claims) {
      if (claims.length >= MAX_CLAIMS) break;
      const claim = normalizeClaim(raw);
      if (claim) claims.push(claim);
    }
  }

  const timeline: TimelineEvent[] = [];
  if (Array.isArray(value.timeline)) {
    for (const raw of value.timeline) {
      if (timeline.length >= MAX_TIMELINE_EVENTS) break;
      const event = normalizeTimelineEvent(raw);
      if (event) timeline.push(event);
    }
  }

  const statusHistory: StatusHistoryEntry[] = [];
  if (Array.isArray(value.statusHistory)) {
    for (const raw of value.statusHistory) {
      if (statusHistory.length >= MAX_STATUS_HISTORY) break;
      const entry = normalizeStatusHistoryEntry(raw);
      if (entry) statusHistory.push(entry);
    }
  }

  const notabilityBasis: NotabilityBasisEntry[] = [];
  if (Array.isArray(value.notabilityBasis)) {
    for (const raw of value.notabilityBasis) {
      if (notabilityBasis.length >= MAX_NOTABILITY_BASIS) break;
      const entry = normalizeNotabilityBasisEntry(raw);
      if (entry) notabilityBasis.push(entry);
    }
  }

  const related: RelatedEntry[] = [];
  if (Array.isArray(value.related)) {
    for (const raw of value.related) {
      if (related.length >= MAX_RELATED_ENTRIES) break;
      const entry = normalizeRelatedEntry(raw);
      if (entry) related.push(entry);
    }
  }

  const relatedNeighbors: RelatedNeighbor[] = [];
  if (Array.isArray(value.relatedNeighbors)) {
    for (const raw of value.relatedNeighbors) {
      if (relatedNeighbors.length >= MAX_RELATED_NEIGHBORS) break;
      const neighbor = normalizeRelatedNeighbor(raw);
      if (neighbor) relatedNeighbors.push(neighbor);
    }
  }

  const continueLearning: RelatedNeighbor[] = [];
  if (Array.isArray(value.continueLearning)) {
    for (const raw of value.continueLearning) {
      if (continueLearning.length >= MAX_CONTINUE_LEARNING) break;
      const neighbor = normalizeRelatedNeighbor(raw);
      if (neighbor) continueLearning.push(neighbor);
    }
  }

  const rawNarrative = optionalStr(value.extendedNarrative, MAX_EXTENDED_NARRATIVE_CHARS);

  const media = normalizeMedia(value.primaryImage);
  const eventWindow = normalizeEventWindow(value.eventWindow);
  const sensitivity = normalizeSensitivity(value.sensitivity);
  const geoAnchor = normalizeGeoAnchor(value.geoAnchor);
  const researchCoverage =
    typeof value.researchCoverage === 'string' &&
    (['minimal', 'partial', 'substantial'] as readonly string[]).includes(value.researchCoverage)
      ? (value.researchCoverage as Entity['researchCoverage'])
      : undefined;
  const locationPrecision =
    typeof value.locationPrecision === 'string' &&
    (['city', 'neighborhood', 'campus', 'institution'] as readonly string[]).includes(value.locationPrecision)
      ? (value.locationPrecision as Entity['locationPrecision'])
      : undefined;

  return {
    id,
    kind: typeof value.kind === 'string' ? str(value.kind, 100, 'record') : 'record',
    displayName,
    summary: str(value.summary, MAX_SUMMARY_CHARS, ''),
    ...(optionalStr(value.status, 100) ? { status: optionalStr(value.status, 100) } : {}),
    ...(statusHistory.length > 0 ? { statusHistory } : {}),
    ...(eventWindow ? { eventWindow } : {}),
    eraBuckets: boundedStrArray(value.eraBuckets, MAX_ERA_BUCKETS, 20),
    notabilityLabels: boundedStrArray(value.notabilityLabels, MAX_NOTABILITY_LABELS, 300),
    ...(notabilityBasis.length > 0 ? { notabilityBasis } : {}),
    ...(optionalStr(value.sensitivityClass, 100) ? { sensitivityClass: optionalStr(value.sensitivityClass, 100) } : {}),
    ...(sensitivity ? { sensitivity } : {}),
    topicTags: boundedStrArray(value.topicTags, MAX_TOPIC_TAGS, 100),
    topicIds: boundedStrArray(value.topicIds, MAX_TOPIC_IDS, 100),
    jurisdictionLabel: str(value.jurisdictionLabel, 200, ''),
    ...(locationPrecision ? { locationPrecision } : {}),
    locationLabel: str(value.locationLabel, MAX_SHORT_TEXT, ''),
    relevanceExplanation: str(value.relevanceExplanation, MAX_EXTENDED_NARRATIVE_CHARS / 5, ''),
    historicalContext: str(value.historicalContext, MAX_EXTENDED_NARRATIVE_CHARS / 5, ''),
    ...(rawNarrative ? { extendedNarrative: rawNarrative } : {}),
    ...(media ? { primaryImage: media } : {}),
    recordMaturity: str(value.recordMaturity, 100, ''),
    ...(researchCoverage ? { researchCoverage } : {}),
    ...(geoAnchor ? { geoAnchor } : {}),
    claims,
    timeline,
    revision: normalizeRevision(value.revision),
    ...(related.length > 0 ? { related } : {}),
    ...(relatedNeighbors.length > 0 ? { relatedNeighbors } : {}),
    ...(continueLearning.length > 0 ? { continueLearning } : {}),
  };
}
