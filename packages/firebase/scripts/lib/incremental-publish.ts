/**
 * Pure helpers for gated incremental upsert into bb_public.release_entities (+ search_index).
 * Used by publish-release-entities-incremental.ts and unit tests — no database I/O.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  US_STATES,
  buildReleaseEntityArtifacts,
  type ReleaseEntityProjectionFields,
  type ReleaseSearchIndexFields,
  type ReleaseSourceClaim,
  type ReleaseSourceEntity,
} from '@repo/domain';
import { computeClaimConfidence } from '../lib/confidence.ts';

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

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Readonly<Record<string, unknown>>;
  }
  return {};
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

export function buildReleaseSourceFromLandscape(row: LandscapePublishRow): ReleaseSourceEntity | null {
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

  const claim: ReleaseSourceClaim = {
    predicate: 'documented_site',
    object: summary,
    confidenceLevel: 'high',
    citationSource: hostname,
    citationHref: canonicalUrl,
    citationLabel: hostname,
  };

  return {
    id: row.id,
    kind: row.kind,
    displayName,
    summary,
    jurisdictionLabel: jurisdictionFromProvenance(provenance),
    locationPrecision: 'site',
    locationLabel: locationLabelFromProvenance(displayName, provenance),
    lat: row.lat,
    lng: row.lng,
    claims: [claim],
    mentionedEntityIds: [],
  };
}

export function gateLandscapePublishCandidate(input: {
  readonly row: LandscapePublishRow;
  readonly catalogEntry?: ReleaseSourceEntity;
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly confidenceFloor?: number;
}): PublishGateResult {
  const floor = input.confidenceFloor ?? INCREMENTAL_PUBLISH_CONFIDENCE_FLOOR;
  const row = input.row;

  if (row.kind === 'person') {
    return { eligible: false, reason: 'person_kind', detail: 'kind=person requires privacy review' };
  }
  if (resolveSourceCategory(row) === 'People') {
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
  if (row.exact_in_release) {
    return { eligible: false, reason: 'already_in_public', detail: 'entity id already in active release' };
  }
  if (row.name_overlap) {
    return { eligible: false, reason: 'name_overlap', detail: 'display_name overlaps existing release entity' };
  }

  const entry =
    input.catalogEntry ??
    buildReleaseSourceFromLandscape(row);
  if (!entry) {
    return {
      eligible: false,
      reason: 'missing_canonical_url',
      detail: 'insufficient landscape fields to build release source',
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

  const build = buildReleaseEntityArtifacts(entry, {
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
  });
  if (!build.ok) {
    return {
      eligible: false,
      reason: 'build_failed',
      detail: `${build.reason}: ${build.message}`,
    };
  }

  return { eligible: true, entry, confidence };
}

export function toReleaseEntityRow(projection: ReleaseEntityProjectionFields): ReleaseEntityUpsertRow {
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
    related: projection.related ?? [],
    projection,
  };
}

export function toSearchIndexRow(
  searchIndex: ReleaseSearchIndexFields,
  geohash: string,
): SearchIndexUpsertRow {
  return {
    id: searchIndex.id,
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
}):
  | {
      readonly ok: true;
      readonly entityRow: ReleaseEntityUpsertRow;
      readonly searchRow: SearchIndexUpsertRow;
    }
  | { readonly ok: false; readonly reason: string; readonly detail: string } {
  const build = buildReleaseEntityArtifacts(input.entry, {
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
  });
  if (!build.ok) {
    return { ok: false, reason: build.reason, detail: build.message };
  }
  const entityRow = toReleaseEntityRow(build.projection);
  const searchRow = toSearchIndexRow(build.searchIndex, build.projection.location.geohash);
  return { ok: true, entityRow, searchRow };
}

export function loadCatalogEntriesById(catalogDir: string): Map<string, ReleaseSourceEntity> {
  const index = new Map<string, ReleaseSourceEntity>();
  if (!existsSync(catalogDir)) return index;
  for (const file of readdirSync(catalogDir).filter((name) => name.endsWith('.json')).sort()) {
    if (file.startsWith('auto-promoted-track-b-')) continue;
    const parsed = JSON.parse(readFileSync(join(catalogDir, file), 'utf8')) as unknown;
    if (!Array.isArray(parsed)) continue;
    for (const entry of parsed) {
      if (entry && typeof entry === 'object' && typeof (entry as { id?: string }).id === 'string') {
        index.set((entry as ReleaseSourceEntity).id, entry as ReleaseSourceEntity);
      }
    }
  }
  return index;
}

export function incrementalPublishProvenancePatch(entityId: string): Record<string, unknown> {
  const at = new Date().toISOString();
  return {
    incremental_publish: at,
    incrementalPublishAt: at,
    publishedReleaseEntityId: entityId,
  };
}
