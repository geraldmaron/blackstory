/**
 * Learning-index public entity contract: summary length bars, topic tags,
 * optional extended narrative and rights-gated primary image, plus capped
 * 2-hop “continue learning” composition from 1-hop related edges.
 */
import type { AdjacencyDirection } from '../graph/adjacency.js';
import {
  isPublishableRightsStatus,
  requiresResolvedRights,
  type PublishableRightsStatus,
  type RightsStatus,
} from '../provenance/rights.js';

/** Target minimum character length for a released entity `summary`. */
export const LEARNING_SUMMARY_MIN_CHARS = 120;

/** Soft editorial target upper bound for entity `summary`. */
export const LEARNING_SUMMARY_TARGET_MAX_CHARS = 280;

/** Hard maximum character length for a released entity `summary`. */
export const LEARNING_SUMMARY_MAX_CHARS = 400;

/** Max 1-hop related rows to display on the entity page. */
export const LEARNING_RELATED_DISPLAY_CAP = 8;

/** Max 2-hop “also connected” stubs composed at read time. */
export const LEARNING_CONTINUE_LEARNING_CAP = 6;

/** Loose related edge accepted from projections or seeds (type is stringly typed). */
export type LearningRelatedEdge = {
  readonly id: string;
  readonly type: string;
  readonly direction: AdjacencyDirection;
  readonly timespan?: {
    readonly label?: string;
    readonly validFrom?: string;
    readonly validTo?: string | null;
  };
};

export type PublicEntityPrimaryImage = {
  readonly url: string;
  readonly alt: string;
  readonly credit: string;
  readonly rightsStatus: PublishableRightsStatus;
  readonly width?: number;
  readonly height?: number;
  readonly objectPath?: string;
};

export type RelatedNeighborStub = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: string;
  readonly summary: string;
  readonly relationType: string;
  readonly direction: AdjacencyDirection;
  readonly timespan?: LearningRelatedEdge['timespan'];
};

export type LearningIndexProjectionFields = {
  readonly summary: string;
  readonly topicTags?: readonly string[];
  readonly historicalContext?: string;
  readonly extendedNarrative?: string;
  readonly primaryImage?: PublicEntityPrimaryImage;
  readonly related?: readonly LearningRelatedEdge[];
};

export type LearningIndexContractIssue = {
  readonly code:
    | 'summary_missing'
    | 'summary_too_short'
    | 'summary_too_long'
    | 'primary_image_rights'
    | 'primary_image_alt'
    | 'primary_image_credit'
    | 'primary_image_url';
  readonly message: string;
};

/**
 * Validate summary length against the learning-index contract.
 * Returns issues (empty = ok). Does not throw.
 */
export function validateLearningSummary(summary: string | undefined): readonly LearningIndexContractIssue[] {
  const issues: LearningIndexContractIssue[] = [];
  const trimmed = summary?.trim() ?? '';
  if (trimmed.length === 0) {
    issues.push({ code: 'summary_missing', message: 'Released entities require a non-empty summary.' });
    return issues;
  }
  if (trimmed.length < LEARNING_SUMMARY_MIN_CHARS) {
    issues.push({
      code: 'summary_too_short',
      message: `Summary must be at least ${LEARNING_SUMMARY_MIN_CHARS} characters (got ${trimmed.length}).`,
    });
  }
  if (trimmed.length > LEARNING_SUMMARY_MAX_CHARS) {
    issues.push({
      code: 'summary_too_long',
      message: `Summary must be at most ${LEARNING_SUMMARY_MAX_CHARS} characters (got ${trimmed.length}).`,
    });
  }
  return issues;
}

/**
 * Validate optional primary image for publication. Missing image → no issues.
 * Present image must clear media rights and include alt + credit + url.
 */
export function validatePrimaryImageForPublication(
  image: PublicEntityPrimaryImage | undefined,
): readonly LearningIndexContractIssue[] {
  if (image === undefined) return [];
  const issues: LearningIndexContractIssue[] = [];
  if (!image.url.trim()) {
    issues.push({ code: 'primary_image_url', message: 'primaryImage.url must be non-empty.' });
  }
  if (!image.alt.trim()) {
    issues.push({ code: 'primary_image_alt', message: 'primaryImage.alt is required for accessibility.' });
  }
  if (!image.credit.trim()) {
    issues.push({ code: 'primary_image_credit', message: 'primaryImage.credit is required for attribution.' });
  }
  if (requiresResolvedRights('media') && !isPublishableRightsStatus(image.rightsStatus as RightsStatus)) {
    issues.push({
      code: 'primary_image_rights',
      message: `primaryImage.rightsStatus "${image.rightsStatus}" is not publishable for display_media.`,
    });
  }
  return issues;
}

/**
 * Full learning-index gate for a projection-shaped payload.
 */
export function validateLearningIndexProjection(
  fields: LearningIndexProjectionFields,
): readonly LearningIndexContractIssue[] {
  return [
    ...validateLearningSummary(fields.summary),
    ...validatePrimaryImageForPublication(fields.primaryImage),
  ];
}

/**
 * Throw when learning-index hard gates fail (summary + image rights).
 * Empty topicTags do not throw — callers may warn.
 */
export function assertLearningIndexProjection(fields: LearningIndexProjectionFields): void {
  const issues = validateLearningIndexProjection(fields);
  if (issues.length > 0) {
    throw new Error(`Learning-index projection rejected: ${issues.map((i) => i.message).join(' ')}`);
  }
}

/** True when topicTags is missing or empty (soft preference, not a hard fail). */
export function hasPreferredTopicTags(topicTags: readonly string[] | undefined): boolean {
  return (topicTags?.length ?? 0) > 0;
}

/**
 * Drop primaryImage when rights/alt/credit/url fail; otherwise return as-is.
 */
export function sanitizePrimaryImageForRelease(
  image: PublicEntityPrimaryImage | undefined,
): PublicEntityPrimaryImage | undefined {
  if (image === undefined) return undefined;
  if (validatePrimaryImageForPublication(image).length > 0) return undefined;
  return image;
}

export type NeighborLookup = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: string;
  readonly summary: string;
  readonly related?: readonly LearningRelatedEdge[];
};

function toNeighborStub(entry: LearningRelatedEdge, neighbor: NeighborLookup): RelatedNeighborStub {
  return entry.timespan !== undefined
    ? {
        id: neighbor.id,
        displayName: neighbor.displayName,
        kind: neighbor.kind,
        summary: neighbor.summary,
        relationType: entry.type,
        direction: entry.direction,
        timespan: entry.timespan,
      }
    : {
        id: neighbor.id,
        displayName: neighbor.displayName,
        kind: neighbor.kind,
        summary: neighbor.summary,
        relationType: entry.type,
        direction: entry.direction,
      };
}

/**
 * Build denormalized 1-hop stubs from related edges + a neighbor lookup map.
 */
export function buildRelatedNeighborStubs(
  related: readonly LearningRelatedEdge[] | undefined,
  neighborsById: ReadonlyMap<string, NeighborLookup>,
  options: { readonly displayCap?: number } = {},
): readonly RelatedNeighborStub[] {
  const cap = options.displayCap ?? LEARNING_RELATED_DISPLAY_CAP;
  if (!related || related.length === 0) return [];
  const stubs: RelatedNeighborStub[] = [];
  for (const entry of related) {
    if (stubs.length >= cap) break;
    const neighbor = neighborsById.get(entry.id);
    if (!neighbor) continue;
    stubs.push(toNeighborStub(entry, neighbor));
  }
  return stubs;
}

/**
 * Compose capped 2-hop “continue learning” stubs from each 1-hop neighbor’s related list.
 * Excludes self and already-listed 1-hop ids. Prefers neighbors with non-empty summary.
 */
export function composeContinueLearningStubs(
  entityId: string,
  oneHop: readonly RelatedNeighborStub[],
  neighborsById: ReadonlyMap<string, NeighborLookup>,
  options: { readonly cap?: number } = {},
): readonly RelatedNeighborStub[] {
  const cap = options.cap ?? LEARNING_CONTINUE_LEARNING_CAP;
  const excluded = new Set<string>([entityId, ...oneHop.map((s) => s.id)]);
  const candidates: RelatedNeighborStub[] = [];

  for (const hop of oneHop) {
    const neighbor = neighborsById.get(hop.id);
    const edges = neighbor?.related ?? [];
    for (const entry of edges) {
      if (excluded.has(entry.id)) continue;
      const twoHop = neighborsById.get(entry.id);
      if (!twoHop) continue;
      excluded.add(entry.id);
      candidates.push(toNeighborStub(entry, twoHop));
    }
  }

  candidates.sort((a, b) => {
    const aEmpty = a.summary.trim().length === 0 ? 1 : 0;
    const bEmpty = b.summary.trim().length === 0 ? 1 : 0;
    if (aEmpty !== bEmpty) return aEmpty - bEmpty;
    return a.displayName.localeCompare(b.displayName);
  });

  return candidates.slice(0, cap);
}
