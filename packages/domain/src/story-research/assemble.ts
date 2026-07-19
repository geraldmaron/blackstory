/**
 * Deterministic story skeleton from brief + anchors. No LLM — the cite-bound
 * scaffold an agent may only paraphrase inside, never invent outside.
 */

import type { NamedAnchor } from './anchor.js';
import type { StoryResearchBrief } from './brief.js';
import { buildStoryCiteEntry, type StoryCiteEntry } from './cite-map.js';
import type { StoryDraft, StoryDraftSection } from './packet.js';

export type AssembleStorySkeletonInput = {
  readonly brief: StoryResearchBrief;
  readonly anchors: readonly NamedAnchor[];
  readonly title: string;
  readonly dek: string;
  readonly eraLabel: string;
  readonly placeLabel: string;
  readonly slug?: string;
};

export type AssembledStorySkeleton = {
  readonly draft: StoryDraft;
  readonly citeMap: readonly StoryCiteEntry[];
};

function anchorLine(anchor: NamedAnchor): string {
  const parts = [
    anchor.who,
    anchor.whenLabel,
    anchor.whereLabel,
    anchor.instrument ? `instrument: ${anchor.instrument}` : undefined,
  ].filter((part): part is string => part !== undefined && part.length > 0);
  const base = parts.join(' · ');
  return anchor.note ? `${base}. ${anchor.note}` : base;
}

function citeForAnchor(anchor: NamedAnchor, sentenceId: string, text: string): StoryCiteEntry {
  if (anchor.resolvedCiteKind && anchor.resolvedCiteId) {
    return buildStoryCiteEntry({
      sentenceId,
      text,
      citeKind: anchor.resolvedCiteKind,
      citeId: anchor.resolvedCiteId,
    });
  }
  return buildStoryCiteEntry({
    sentenceId,
    text,
    citeKind: 'unresolved',
  });
}

/**
 * Builds a place-first skeleton: thesis framing, start-line move, named anchors,
 * winner-built test, present bridge / verification rule. Framing sentences are
 * marked `framing`; anchor sentences inherit resolved cites or stay unresolved.
 */
export function assembleStorySkeleton(input: AssembleStorySkeletonInput): AssembledStorySkeleton {
  const citeMap: StoryCiteEntry[] = [];
  const sections: StoryDraftSection[] = [];
  let sentenceSeq = 0;
  const nextId = (prefix: string) => `${prefix}-${++sentenceSeq}`;

  const framingOpen = `The popular telling often starts here: ${input.brief.conventionalStartLine}`;
  const framingRelocate = `The archive starts earlier: ${input.brief.relocatedStartLine}`;
  const framingThesis = input.brief.thesisQuestion;

  citeMap.push(
    buildStoryCiteEntry({
      sentenceId: nextId('framing'),
      text: framingThesis,
      citeKind: 'framing',
    }),
    buildStoryCiteEntry({
      sentenceId: nextId('framing'),
      text: framingOpen,
      citeKind: 'framing',
    }),
    buildStoryCiteEntry({
      sentenceId: nextId('framing'),
      text: framingRelocate,
      citeKind: 'framing',
    }),
  );

  sections.push({
    paragraphs: [framingThesis, framingOpen, framingRelocate],
  });

  const omitted = input.anchors.filter((a) => a.role === 'omitted' || a.role === 'named_case');
  if (omitted.length > 0) {
    const paragraphs: string[] = [];
    for (const anchor of omitted) {
      const text = anchorLine(anchor);
      const sentenceId = nextId('anchor');
      citeMap.push(citeForAnchor(anchor, sentenceId, text));
      paragraphs.push(text);
    }
    sections.push({
      heading: 'What the middle of the story left out',
      paragraphs,
    });
  }

  if (input.brief.winnerBuiltTest) {
    const text = `What the winners built: ${input.brief.winnerBuiltTest.outcomeDocument}. ${input.brief.winnerBuiltTest.whatItProves}`;
    const winnerAnchors = input.anchors.filter((a) => a.role === 'winner_built');
    const sentenceId = nextId('winner');
    if (winnerAnchors[0]) {
      citeMap.push(citeForAnchor(winnerAnchors[0], sentenceId, text));
    } else {
      citeMap.push(buildStoryCiteEntry({ sentenceId, text, citeKind: 'unresolved' }));
    }
    sections.push({
      heading: 'What the winners built',
      paragraphs: [text],
    });
  }

  const witnesses = input.anchors.filter(
    (a) => a.role === 'authority_witness' && a.resolvedCiteKind && a.resolvedCiteId,
  );
  if (witnesses.length > 0) {
    const paragraphs: string[] = [];
    for (const anchor of witnesses) {
      const text = anchorLine(anchor);
      const sentenceId = nextId('witness');
      citeMap.push(citeForAnchor(anchor, sentenceId, text));
      paragraphs.push(text);
    }
    sections.push({
      heading: 'Authority witnesses',
      paragraphs,
    });
  }

  if (input.brief.mechanismLayers.length > 0) {
    const paragraphs = input.brief.mechanismLayers.map(
      (layer) => `${layer.kind}: ${layer.summary}`,
    );
    for (const text of paragraphs) {
      citeMap.push(
        buildStoryCiteEntry({
          sentenceId: nextId('mechanism'),
          text,
          citeKind: 'framing',
        }),
      );
    }
    sections.push({
      heading: 'How it worked',
      paragraphs,
    });
  }

  if (input.brief.presentBridge || input.brief.verificationRule) {
    const paragraphs: string[] = [];
    if (input.brief.presentBridge) {
      const text = `${input.brief.presentBridge.continuityClaim} Check: ${input.brief.presentBridge.verificationOffRamp}`;
      const bridgeAnchor = input.anchors.find((a) => a.role === 'present_bridge');
      const sentenceId = nextId('bridge');
      if (bridgeAnchor) {
        citeMap.push(citeForAnchor(bridgeAnchor, sentenceId, text));
      } else {
        citeMap.push(buildStoryCiteEntry({ sentenceId, text, citeKind: 'framing' }));
      }
      paragraphs.push(text);
    }
    if (input.brief.verificationRule) {
      const text = input.brief.verificationRule;
      citeMap.push(
        buildStoryCiteEntry({
          sentenceId: nextId('verify'),
          text,
          citeKind: 'framing',
        }),
      );
      paragraphs.push(text);
    }
    sections.push({
      heading: 'What to check',
      paragraphs,
    });
  }

  const draft: StoryDraft = {
    ...(input.slug !== undefined ? { slug: input.slug } : {}),
    title: input.title,
    dek: input.dek,
    eraLabel: input.eraLabel,
    placeLabel: input.placeLabel,
    body: sections,
  };

  return Object.freeze({
    draft: Object.freeze(draft),
    citeMap: Object.freeze(citeMap),
  });
}
