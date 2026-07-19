/**
 * Story research runner: build methodology brief + anchors, assemble cite-bound
 * skeleton, validate against citation/dignity gates, emit staged packets.
 * Prepare-only; never publishes to /stories.
 */
import {
  assembleStorySkeleton,
  buildNamedAnchor,
  buildStoryResearchBrief,
  buildStoryResearchPacket,
  collectAuthorityLeadUrls,
  validateStoryResearchPacket,
  type CanonicalClaim,
  type NamedAnchor,
  type StoryResearchBrief,
  type StoryResearchDecision,
  type StoryResearchPacket,
} from '@repo/domain';
import { createLlmProvider, type LlmProvider } from './llm-provider.js';
import type { OperatorIdentity } from './identity.js';

export type StoryTopicSeed = {
  readonly topicId: string;
  readonly title: string;
  readonly eraLabel?: string;
  readonly placeLabel?: string;
  readonly relatedEntityIds?: readonly string[];
  readonly relatedFactIds?: readonly string[];
  /** Optional published claims the mock/LLM may bind as cites. */
  readonly publishedClaims?: readonly {
    readonly id: string;
    readonly workflowStatus: CanonicalClaim['workflowStatus'];
    readonly publicationStatus: CanonicalClaim['publicationStatus'];
    readonly label?: string;
    readonly role?: NamedAnchor['role'];
  }[];
  readonly authorityLeadHints?: readonly string[];
  readonly sourceSnippets?: readonly string[];
};

export type StoryResearchRunInput = {
  readonly topics: readonly StoryTopicSeed[];
  readonly identity: OperatorIdentity;
  readonly nowIso: string;
  readonly provider?: LlmProvider;
  readonly model?: string;
};

export type StoryResearchRunItem = {
  readonly packet: StoryResearchPacket;
  readonly rawModelContent?: string;
};

export type StoryResearchRunResult = {
  readonly kind: 'story.research.run.v1';
  readonly items: readonly StoryResearchRunItem[];
  readonly recommendCount: number;
  readonly rejectCount: number;
  readonly needsEvidenceCount: number;
  readonly completedAt: string;
};

type ModelBriefJson = {
  readonly decision?: string;
  readonly rationale?: string;
  readonly confidence?: number;
  readonly thesisQuestion?: string;
  readonly conventionalStartLine?: string;
  readonly relocatedStartLine?: string;
  readonly mechanismSummary?: string;
  readonly winnerBuiltDocument?: string;
  readonly winnerBuiltProves?: string;
  readonly verificationRule?: string;
  readonly title?: string;
  readonly dek?: string;
};

const SYSTEM_PROMPT = `You are a story research assistant for BlackStory (History, pinned to place).
Return ONLY JSON with keys:
decision (recommend|needs_evidence|reject), rationale, confidence (0-1),
thesisQuestion, conventionalStartLine, relocatedStartLine,
mechanismSummary?, winnerBuiltDocument?, winnerBuiltProves?, verificationRule?,
title, dek.
Rules:
- Use the storyteller research METHOD (start-line relocation, omitted actors, winner-built test)
  but BlackStory VOICE: place-first, evidence before assertion, never trauma-forward hooks.
- Do not invent citations, market figures, or graphic violence as the opener.
- Prefer needs_evidence when claims are thin.`;

function parseDecision(raw: string | undefined): StoryResearchDecision {
  if (raw === 'reject' || raw === 'needs_evidence' || raw === 'recommend') return raw;
  return 'needs_evidence';
}

function extractJsonObject(content: string): ModelBriefJson {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed) as ModelBriefJson;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as ModelBriefJson;
    }
    throw new Error('Model response was not valid JSON');
  }
}

function mockBriefFromTopic(topic: StoryTopicSeed): ModelBriefJson {
  const hasWinnerInstrument =
    (topic.relatedFactIds?.length ?? 0) > 0 ||
    (topic.publishedClaims?.some((c) => c.role === 'winner_built') ?? false);

  return {
    decision: 'recommend',
    rationale: 'Mock provider: assembled cite-bound skeleton for human review; not published.',
    confidence: 0.55,
    thesisQuestion: `What does the usual telling of “${topic.title}” leave out when the start line moves earlier?`,
    conventionalStartLine: `The middle of the popular story about ${topic.title}.`,
    relocatedStartLine: `An earlier, checkable origin for ${topic.title} pinned to place and archive.`,
    mechanismSummary: `Institutional and legal outcomes around ${topic.title} reveal intent better than rhetoric.`,
    ...(hasWinnerInstrument
      ? {
          winnerBuiltDocument: `Primary outcome document linked to ${topic.title}`,
          winnerBuiltProves: 'What the winners built after the familiar middle chapter.',
        }
      : {}),
    verificationRule:
      'Move the starting line, then judge by documents and published claims — not props.',
    title: topic.title,
    dek: `A place-first narrative that relocates the start line for ${topic.title} and off-ramps to archive records.`,
  };
}

function buildBriefFromModel(parsed: ModelBriefJson, topic: StoryTopicSeed): StoryResearchBrief {
  return buildStoryResearchBrief({
    thesisQuestion:
      parsed.thesisQuestion?.trim() ||
      `What does the archive show about ${topic.title} once the start line moves?`,
    conventionalStartLine:
      parsed.conventionalStartLine?.trim() ||
      `The conventional middle of the ${topic.title} story.`,
    relocatedStartLine:
      parsed.relocatedStartLine?.trim() || `An earlier documented origin for ${topic.title}.`,
    mechanismLayers: parsed.mechanismSummary
      ? [{ kind: 'institutional', summary: parsed.mechanismSummary.trim() }]
      : [],
    ...(parsed.winnerBuiltDocument && parsed.winnerBuiltProves
      ? {
          winnerBuiltTest: {
            outcomeDocument: parsed.winnerBuiltDocument.trim(),
            whatItProves: parsed.winnerBuiltProves.trim(),
          },
        }
      : {}),
    ...(parsed.verificationRule ? { verificationRule: parsed.verificationRule.trim() } : {}),
  });
}

function harvestAnchors(topic: StoryTopicSeed): NamedAnchor[] {
  const anchors: NamedAnchor[] = [];
  const claims = topic.publishedClaims ?? [];
  for (const [index, claim] of claims.entries()) {
    const role = claim.role ?? (index === 0 ? 'named_case' : 'omitted');
    const anchor = buildNamedAnchor({
      id: `anchor-${claim.id}`,
      role:
        role === 'winner_built' ||
        role === 'authority_witness' ||
        role === 'present_bridge' ||
        role === 'conventional' ||
        role === 'named_case' ||
        role === 'omitted'
          ? role
          : 'named_case',
      who: claim.label ?? claim.id,
      resolvedCiteKind: 'claim',
      resolvedCiteId: claim.id,
    });
    if (anchor) anchors.push(anchor);
  }

  for (const [index, entityId] of (topic.relatedEntityIds ?? []).entries()) {
    if (anchors.some((a) => a.resolvedCiteId === entityId)) continue;
    const anchor = buildNamedAnchor({
      id: `anchor-entity-${entityId}`,
      role: index === 0 ? 'conventional' : 'omitted',
      who: entityId,
      resolvedCiteKind: 'entity',
      resolvedCiteId: entityId,
    });
    if (anchor) anchors.push(anchor);
  }

  for (const [index, factId] of (topic.relatedFactIds ?? []).entries()) {
    const anchor = buildNamedAnchor({
      id: `anchor-fact-${factId}`,
      role: index === 0 ? 'winner_built' : 'named_case',
      instrument: factId,
      resolvedCiteKind: 'fact',
      resolvedCiteId: factId,
    });
    if (anchor) anchors.push(anchor);
  }

  for (const [index, url] of (topic.authorityLeadHints ?? []).entries()) {
    const anchor = buildNamedAnchor({
      id: `anchor-lead-${index}`,
      role: 'authority_witness',
      note: 'Authority-host lead only — open a research case before citing in body.',
      authorityLeadUrl: url,
    });
    if (anchor) anchors.push(anchor);
  }

  return anchors;
}

export async function runStoryResearch(
  input: StoryResearchRunInput,
): Promise<StoryResearchRunResult> {
  const provider = input.provider ?? createLlmProvider({ provider: 'mock' });
  const items: StoryResearchRunItem[] = [];

  for (const topic of input.topics) {
    let parsed: ModelBriefJson;
    let rawModelContent: string | undefined;

    if (provider.id === 'mock') {
      parsed = mockBriefFromTopic(topic);
      rawModelContent = JSON.stringify(parsed);
    } else {
      const completion = await provider.complete({
        model: input.model ?? 'mock-story-research-v1',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              topicId: topic.topicId,
              title: topic.title,
              eraLabel: topic.eraLabel ?? null,
              placeLabel: topic.placeLabel ?? null,
              relatedEntityIds: topic.relatedEntityIds ?? [],
              relatedFactIds: topic.relatedFactIds ?? [],
              publishedClaimIds: (topic.publishedClaims ?? []).map((c) => c.id),
              sourceSnippets: topic.sourceSnippets ?? [],
            }),
          },
        ],
      });
      rawModelContent = completion.content;
      parsed = extractJsonObject(completion.content);
    }

    const brief = buildBriefFromModel(parsed, topic);
    const anchors = harvestAnchors(topic);
    const skeleton = assembleStorySkeleton({
      brief,
      anchors,
      title: parsed.title?.trim() || topic.title,
      dek:
        parsed.dek?.trim() || `Place-first narrative relocating the start line for ${topic.title}.`,
      eraLabel: topic.eraLabel?.trim() || 'Undated',
      placeLabel: topic.placeLabel?.trim() || 'Place TBD',
      slug: topic.topicId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    });

    const claimLookup = (claimId: string) => {
      const found = topic.publishedClaims?.find((c) => c.id === claimId);
      if (!found) return undefined;
      return {
        workflowStatus: found.workflowStatus,
        publicationStatus: found.publicationStatus,
      };
    };

    const proposed = parseDecision(parsed.decision);
    const validation = validateStoryResearchPacket({
      brief,
      citeMap: skeleton.citeMap,
      draft: skeleton.draft,
      relatedEntityIds: topic.relatedEntityIds ?? [],
      relatedFactIds: topic.relatedFactIds ?? [],
      proposedDecision: proposed,
      lookupClaim: claimLookup,
    });

    const packet = buildStoryResearchPacket({
      topicId: topic.topicId,
      topicTitle: topic.title,
      decision: validation.decision,
      rationale: parsed.rationale?.trim() || validation.issues.join('; ') || 'No rationale.',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.4,
      brief,
      anchors,
      citeMap: skeleton.citeMap,
      relatedEntityIds: topic.relatedEntityIds ?? [],
      relatedFactIds: topic.relatedFactIds ?? [],
      draft: skeleton.draft,
      validationIssues: validation.issues,
      authorityLeadUrls: collectAuthorityLeadUrls(anchors),
      model: { provider: provider.id, modelId: input.model ?? 'mock-story-research-v1' },
      createdAt: input.nowIso,
      operatorId: input.identity.operatorId,
      sessionId: input.identity.sessionId,
    });

    items.push({
      packet,
      ...(rawModelContent !== undefined ? { rawModelContent } : {}),
    });
  }

  return {
    kind: 'story.research.run.v1',
    items,
    recommendCount: items.filter((item) => item.packet.decision === 'recommend').length,
    rejectCount: items.filter((item) => item.packet.decision === 'reject').length,
    needsEvidenceCount: items.filter((item) => item.packet.decision === 'needs_evidence').length,
    completedAt: input.nowIso,
  };
}
