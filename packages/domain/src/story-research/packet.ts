/**
 * Story research packet contract: brief, anchors, cite map, draft body aligned
 * with the public story projection shape. Staging only, never publication authority.
 */

import type { NamedAnchor } from './anchor.js';
import type { StoryResearchBrief } from './brief.js';
import type { StoryCiteEntry } from './cite-map.js';

export const STORY_RESEARCH_PACKET_KIND = 'story.research.packet.v1' as const;

export type StoryResearchDecision = 'recommend' | 'needs_evidence' | 'reject';

/** Mirrors publicStoryProjection draft fields without coupling to Firestore. */
export type StoryDraftSection = {
  readonly heading?: string;
  readonly paragraphs: readonly string[];
};

export type StoryDraft = {
  readonly slug?: string;
  readonly title: string;
  readonly dek: string;
  readonly eraLabel: string;
  readonly placeLabel: string;
  readonly body: readonly StoryDraftSection[];
};

export type StoryResearchPacketModel = {
  readonly provider: string;
  readonly modelId: string;
};

export type StoryResearchPacket = {
  readonly kind: typeof STORY_RESEARCH_PACKET_KIND;
  readonly topicId: string;
  readonly topicTitle?: string;
  readonly decision: StoryResearchDecision;
  readonly rationale: string;
  readonly confidence: number;
  readonly brief: StoryResearchBrief;
  readonly anchors: readonly NamedAnchor[];
  readonly citeMap: readonly StoryCiteEntry[];
  readonly relatedEntityIds: readonly string[];
  readonly relatedFactIds: readonly string[];
  readonly draft: StoryDraft;
  readonly validationIssues: readonly string[];
  readonly authorityLeadUrls: readonly string[];
  readonly model?: StoryResearchPacketModel;
  readonly createdAt: string;
  readonly operatorId?: string;
  readonly sessionId?: string;
};

export type BuildStoryResearchPacketInput = {
  readonly topicId: string;
  readonly topicTitle?: string;
  readonly decision: StoryResearchDecision;
  readonly rationale: string;
  readonly confidence: number;
  readonly brief: StoryResearchBrief;
  readonly anchors: readonly NamedAnchor[];
  readonly citeMap: readonly StoryCiteEntry[];
  readonly relatedEntityIds?: readonly string[];
  readonly relatedFactIds?: readonly string[];
  readonly draft: StoryDraft;
  readonly validationIssues?: readonly string[];
  readonly authorityLeadUrls?: readonly string[];
  readonly model?: StoryResearchPacketModel;
  readonly createdAt: string;
  readonly operatorId?: string;
  readonly sessionId?: string;
};

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function freezeDraft(draft: StoryDraft): StoryDraft {
  return Object.freeze({
    ...(draft.slug !== undefined ? { slug: draft.slug } : {}),
    title: draft.title,
    dek: draft.dek,
    eraLabel: draft.eraLabel,
    placeLabel: draft.placeLabel,
    body: Object.freeze(
      draft.body.map((section) =>
        Object.freeze({
          ...(section.heading !== undefined ? { heading: section.heading } : {}),
          paragraphs: Object.freeze([...section.paragraphs]),
        }),
      ),
    ),
  });
}

/** Pure builder for a staged story research packet. */
export function buildStoryResearchPacket(
  input: BuildStoryResearchPacketInput,
): StoryResearchPacket {
  return Object.freeze({
    kind: STORY_RESEARCH_PACKET_KIND,
    topicId: input.topicId,
    ...(input.topicTitle !== undefined ? { topicTitle: input.topicTitle } : {}),
    decision: input.decision,
    rationale: input.rationale,
    confidence: clampConfidence(input.confidence),
    brief: input.brief,
    anchors: Object.freeze([...input.anchors]),
    citeMap: Object.freeze([...input.citeMap]),
    relatedEntityIds: Object.freeze([...(input.relatedEntityIds ?? [])]),
    relatedFactIds: Object.freeze([...(input.relatedFactIds ?? [])]),
    draft: freezeDraft(input.draft),
    validationIssues: Object.freeze([...(input.validationIssues ?? [])]),
    authorityLeadUrls: Object.freeze([...(input.authorityLeadUrls ?? [])]),
    ...(input.model !== undefined ? { model: input.model } : {}),
    createdAt: input.createdAt,
    ...(input.operatorId !== undefined ? { operatorId: input.operatorId } : {}),
    ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
  });
}

/**
 * Map an approved packet onto the public story projection shape (human paste path).
 * Does not write anything. Returns a plain object for operator handoff into
 * `packages/firebase` public story seed / release fixtures.
 */
export function storyPacketToSeedRecord(
  packet: StoryResearchPacket,
  publishedAt: string,
): {
  readonly slug: string;
  readonly title: string;
  readonly dek: string;
  readonly publishedAt: string;
  readonly eraLabel: string;
  readonly placeLabel: string;
  readonly body: readonly StoryDraftSection[];
  readonly relatedEntityIds: readonly string[];
  readonly relatedFactIds: readonly string[];
} {
  const slug =
    packet.draft.slug?.trim() ||
    packet.topicId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') ||
    'untitled-story';

  return Object.freeze({
    slug,
    title: packet.draft.title,
    dek: packet.draft.dek,
    publishedAt,
    eraLabel: packet.draft.eraLabel,
    placeLabel: packet.draft.placeLabel,
    body: packet.draft.body,
    relatedEntityIds: packet.relatedEntityIds,
    relatedFactIds: packet.relatedFactIds,
  });
}
