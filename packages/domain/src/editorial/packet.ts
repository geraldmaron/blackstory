/**
 * Editorial packet contract and pure builder for operator review sessions:
 * subject metadata, draft fields, parsed prose links, and validation issues.
 */
import { parseProseEntityLinks, type ProseEntityRef } from './prose-links.js';

export const EDITORIAL_PACKET_KIND = 'editorial.packet.v1' as const;

export type EditorialDecision = 'keep' | 'reject' | 'needs_evidence';

/**
 * Structured claim draft mirroring `ReleaseSourceClaim` so kept subjects arrive
 * publish-shaped instead of needing a manual claims backfill. Citations must point
 * at sources the judge was actually given — validation rejects fabricated hrefs.
 */
export type EditorialClaimDraft = {
  readonly predicate: string;
  readonly object: string;
  readonly confidenceLevel: 'high' | 'medium' | 'low';
  readonly citationSource: string;
  readonly citationHref: string;
  readonly citationLabel: string;
};

/**
 * Judge-derived text location, distinct from a subject's own lat/lng (which comes
 * from a structured source like Wikidata coordinates, never guessed by the judge).
 * Omit entirely when the subject has no single documented location (most
 * organizations, laws, and movements legitimately don't) — that's correct, not a
 * gap to force-fill.
 */
export type EditorialLocationDraft = {
  readonly jurisdictionLabel: string;
  readonly locationLabel: string;
  readonly locationPrecision: string;
};

export type EditorialFieldDraft = {
  readonly publicSummary?: string;
  readonly historicalContext?: string;
  readonly identityLabel?: string;
  readonly relevanceNote?: string;
  readonly relatedEntityIds?: readonly string[];
  readonly proposedRelationshipNotes?: string;
  /** Full-field enrichment (v2): claim drafts with per-claim citations. */
  readonly claims?: readonly EditorialClaimDraft[];
  /** Registered topic ids only — validated against the topic registry. */
  readonly topicIds?: readonly string[];
  /** Decade buckets like "1910s"; only when the era is evidenced. */
  readonly eraBuckets?: readonly string[];
  readonly keywords?: readonly string[];
  readonly location?: EditorialLocationDraft;
};

export type EditorialPacketModel = {
  readonly provider: string;
  readonly modelId: string;
};

export type EditorialPacket = {
  readonly kind: typeof EDITORIAL_PACKET_KIND;
  readonly subjectId: string;
  readonly subjectTitle?: string;
  readonly decision: EditorialDecision;
  readonly rationale: string;
  readonly confidence: number;
  readonly drafts: EditorialFieldDraft;
  readonly proseLinks: readonly ProseEntityRef[];
  readonly validationIssues: readonly string[];
  readonly model?: EditorialPacketModel;
  readonly createdAt: string;
  readonly operatorId?: string;
  readonly sessionId?: string;
};

export type BuildEditorialPacketInput = {
  readonly subjectId: string;
  readonly subjectTitle?: string;
  readonly decision: EditorialDecision;
  readonly rationale: string;
  readonly confidence: number;
  readonly drafts: EditorialFieldDraft;
  readonly validationIssues?: readonly string[];
  readonly model?: EditorialPacketModel;
  readonly createdAt: string;
  readonly operatorId?: string;
  readonly sessionId?: string;
};

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Pure builder; derives prose links from `drafts.publicSummary` when present. */
export function buildEditorialPacket(input: BuildEditorialPacketInput): EditorialPacket {
  const proseLinks = parseProseEntityLinks(input.drafts.publicSummary ?? '');

  return Object.freeze({
    kind: EDITORIAL_PACKET_KIND,
    subjectId: input.subjectId,
    ...(input.subjectTitle !== undefined ? { subjectTitle: input.subjectTitle } : {}),
    decision: input.decision,
    rationale: input.rationale,
    confidence: clampConfidence(input.confidence),
    drafts: input.drafts,
    proseLinks,
    validationIssues: input.validationIssues ?? [],
    ...(input.model !== undefined ? { model: input.model } : {}),
    createdAt: input.createdAt,
    ...(input.operatorId !== undefined ? { operatorId: input.operatorId } : {}),
    ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
  });
}
