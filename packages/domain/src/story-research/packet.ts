/**
 * Story research packet contract: brief, anchors, cite map, draft body aligned
 * with the public story projection shape. Staging only, never publication authority.
 */

import type { NamedAnchor } from './anchor.js';
import type { StoryResearchBrief } from './brief.js';
import type { StoryCiteEntry } from './cite-map.js';
import type { ThemeImpactThemeId } from '../statistics/theme-impact-questions.js';

export const STORY_RESEARCH_PACKET_KIND = 'story.research.packet.v1' as const;

export type StoryResearchDecision = 'recommend' | 'needs_evidence' | 'reject';

/**
 * Mirrors publicStorySectionMomentSchema in packages/schemas/src/public-projections.ts.
 * Anchors a theme-impact packet's data moment to a point within a body section.
 */
export type StoryDraftSectionMoment = {
  readonly packetId: string;
  readonly kind: 'observation' | 'artifact' | 'derived' | 'timeline' | 'map';
  readonly refId: string;
  readonly placement: 'after';
};

/** Mirrors publicStorySectionDisputeSchema in packages/schemas/src/public-projections.ts. */
export type StoryDraftSectionDisputeSide = {
  readonly sourceLabel: string;
  readonly claim: string;
};

export type StoryDraftSectionDispute = {
  readonly label: string;
  readonly sideA: StoryDraftSectionDisputeSide;
  readonly sideB: StoryDraftSectionDisputeSide;
};

/** Mirrors publicStoryProjection draft fields without coupling to Firestore. */
export type StoryDraftSection = {
  readonly heading?: string;
  readonly paragraphs: readonly string[];
  readonly moments?: readonly StoryDraftSectionMoment[];
  readonly disputes?: readonly StoryDraftSectionDispute[];
};

/** Mirrors publicStoryThemeBindingSchema in packages/schemas/src/public-projections.ts. */
export type StoryDraftThemeBinding = {
  readonly themeId: ThemeImpactThemeId;
  readonly chapterIndex: number;
  readonly chapterCount: number;
};

export type StoryDraft = {
  readonly slug?: string;
  readonly title: string;
  readonly dek: string;
  readonly eraLabel: string;
  readonly placeLabel: string;
  readonly body: readonly StoryDraftSection[];
  readonly themeBinding?: StoryDraftThemeBinding;
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
          ...(section.moments !== undefined
            ? { moments: Object.freeze(section.moments.map((m) => Object.freeze({ ...m }))) }
            : {}),
          ...(section.disputes !== undefined
            ? {
                disputes: Object.freeze(
                  section.disputes.map((d) =>
                    Object.freeze({
                      label: d.label,
                      sideA: Object.freeze({ ...d.sideA }),
                      sideB: Object.freeze({ ...d.sideB }),
                    }),
                  ),
                ),
              }
            : {}),
        }),
      ),
    ),
    ...(draft.themeBinding !== undefined
      ? { themeBinding: Object.freeze({ ...draft.themeBinding }) }
      : {}),
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
 * `packages/ops-data` public story seed / release fixtures.
 * `sources` is required: public stories must ship with a cited receipt list.
 */
export function storyPacketToSeedRecord(
  packet: StoryResearchPacket,
  publishedAt: string,
  sources: readonly { readonly label: string; readonly url: string }[],
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
  readonly sources: readonly { readonly label: string; readonly url: string }[];
} {
  const slug =
    packet.draft.slug?.trim() ||
    packet.topicId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') ||
    'untitled-story';

  if (sources.length < 1) {
    throw new Error('storyPacketToSeedRecord requires at least one source citation');
  }

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
    sources: Object.freeze(sources.map((source) => Object.freeze({ ...source }))),
  });
}
