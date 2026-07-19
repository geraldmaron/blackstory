/**
 * Story research packet validation: cite-map fail-closed, narrative claim gates,
 * public-language procedural checks, and dignity heuristics (no trauma-hook openers).
 */

import { evaluatePublicLanguage, type PublicLanguageEvaluation } from '../confidence-engine/index.js';
import { narrativeMayCiteClaim, type CanonicalClaim } from '../claims/index.js';
import { citeEntryIsResolved, type StoryCiteEntry } from './cite-map.js';
import type { StoryDraft, StoryResearchDecision } from './packet.js';
import type { StoryResearchBrief } from './brief.js';

/** Safe default procedural pair for historical narrative language checks. */
export const STORY_LANGUAGE_PROCEDURAL_STATUS = 'ruled' as const;

/** Patterns that mark a trauma-forward hook opener (brand: never default lead). */
const TRAUMA_HOOK_PATTERNS: readonly RegExp[] = [
  /\b(lynched|lynching|burned alive|cut (her|him|them) open|stomped on the baby)\b/i,
  /\b(gouged out|tied .+ barbed wire|threw .+ body into)\b/i,
  /\b(trigger warning|it'?s about to get graphic)\b/i,
  /\b(what the \[?\s*f+\s*\]?\s*did we do)\b/i,
];

const UNSOURCED_SWEEP_PATTERNS: readonly RegExp[] = [
  /\bevery continent\b/i,
  /\bworth (between )?\d+(\.\d+)?(\s+and\s+\d+(\.\d+)?)?\s*(billion|trillion)\b/i,
  /\bover a billion dollars\b/i,
  /\bthe hatred is global\b/i,
];

export type PublishedClaimLookup = (
  claimId: string,
) => Pick<CanonicalClaim, 'workflowStatus' | 'publicationStatus'> | undefined;

export type StoryResearchValidationInput = {
  readonly brief: StoryResearchBrief;
  readonly citeMap: readonly StoryCiteEntry[];
  readonly draft: StoryDraft;
  readonly relatedEntityIds: readonly string[];
  readonly relatedFactIds: readonly string[];
  readonly proposedDecision: StoryResearchDecision;
  /** Optional resolver for claim-cite publishability. */
  readonly lookupClaim?: PublishedClaimLookup;
};

export type StoryResearchValidation = {
  readonly ok: boolean;
  readonly issues: readonly string[];
  /** Decision after gates; never `recommend` when issues remain. */
  readonly decision: StoryResearchDecision;
  readonly language?: PublicLanguageEvaluation;
};

function openingText(draft: StoryDraft): string {
  const first = draft.body[0]?.paragraphs[0] ?? draft.dek;
  return first.trim();
}

function collectDraftText(draft: StoryDraft): string {
  const parts = [draft.title, draft.dek];
  for (const section of draft.body) {
    if (section.heading) parts.push(section.heading);
    parts.push(...section.paragraphs);
  }
  return parts.join('\n');
}

function dignityIssues(draft: StoryDraft, citeMap: readonly StoryCiteEntry[]): string[] {
  const issues: string[] = [];
  const opener = openingText(draft);
  for (const pattern of TRAUMA_HOOK_PATTERNS) {
    if (pattern.test(opener)) {
      issues.push(
        'Trauma-forward opener blocked: lead with place/archive start-line, not graphic violence.',
      );
      break;
    }
  }

  const full = collectDraftText(draft);
  for (const pattern of UNSOURCED_SWEEP_PATTERNS) {
    if (!pattern.test(full)) continue;
    const hasSupportingCite = citeMap.some(
      (entry) =>
        citeEntryIsResolved(entry) &&
        entry.citeKind !== 'framing' &&
        pattern.test(entry.text),
    );
    if (!hasSupportingCite) {
      issues.push(
        `Unsourced sweeping claim matched (${pattern.source}): requires a resolved non-framing cite.`,
      );
    }
  }
  return issues;
}

function citeMapIssues(
  citeMap: readonly StoryCiteEntry[],
  lookupClaim: PublishedClaimLookup | undefined,
): string[] {
  const issues: string[] = [];
  for (const entry of citeMap) {
    if (entry.citeKind === 'framing') continue;

    if (entry.citeKind === 'unresolved' || !citeEntryIsResolved(entry)) {
      issues.push(`Unresolved cite for sentence ${entry.sentenceId}: needs published claim/fact/entity.`);
      continue;
    }

    if (entry.citeKind === 'claim' && entry.citeId) {
      if (!lookupClaim) {
        issues.push(
          `Claim cite ${entry.citeId} on ${entry.sentenceId}: no claim lookup provided (fail closed).`,
        );
        continue;
      }
      const claim = lookupClaim(entry.citeId);
      if (!claim) {
        issues.push(`Claim cite ${entry.citeId} on ${entry.sentenceId}: claim not found.`);
        continue;
      }
      if (!narrativeMayCiteClaim(claim)) {
        issues.push(
          `Claim cite ${entry.citeId} on ${entry.sentenceId}: narrative cannot cite unpublished claim.`,
        );
      }
    }
  }
  return issues;
}

function briefIssues(brief: StoryResearchBrief): string[] {
  const issues: string[] = [];
  if (!brief.thesisQuestion.trim()) issues.push('Brief missing thesisQuestion.');
  if (!brief.conventionalStartLine.trim()) issues.push('Brief missing conventionalStartLine.');
  if (!brief.relocatedStartLine.trim()) issues.push('Brief missing relocatedStartLine.');
  return issues;
}

function draftShapeIssues(draft: StoryDraft): string[] {
  const issues: string[] = [];
  if (!draft.title.trim()) issues.push('Draft missing title.');
  if (!draft.dek.trim()) issues.push('Draft missing dek.');
  if (!draft.eraLabel.trim()) issues.push('Draft missing eraLabel.');
  if (!draft.placeLabel.trim()) issues.push('Draft missing placeLabel.');
  if (draft.body.length === 0) issues.push('Draft body is empty.');
  return issues;
}

/**
 * Validates a story research packet. Never throws.
 * `recommend` is only returned when all gates pass and off-ramps exist.
 */
export function validateStoryResearchPacket(
  input: StoryResearchValidationInput,
): StoryResearchValidation {
  const issues: string[] = [
    ...briefIssues(input.brief),
    ...draftShapeIssues(input.draft),
    ...citeMapIssues(input.citeMap, input.lookupClaim),
    ...dignityIssues(input.draft, input.citeMap),
  ];

  if (input.proposedDecision === 'recommend') {
    if (input.relatedEntityIds.length === 0 && input.relatedFactIds.length === 0) {
      issues.push('Recommend requires relatedEntityIds and/or relatedFactIds off-ramps.');
    }
  }

  const fullText = collectDraftText(input.draft);
  const language = evaluatePublicLanguage({
    text: fullText,
    requestedProceduralStatus: STORY_LANGUAGE_PROCEDURAL_STATUS,
    evidenceProceduralStatus: STORY_LANGUAGE_PROCEDURAL_STATUS,
  });
  for (const violation of language.violations) {
    issues.push(violation);
  }

  let decision: StoryResearchDecision = input.proposedDecision;
  if (issues.length > 0) {
    if (decision === 'recommend') {
      decision = 'needs_evidence';
    }
  } else if (decision === 'recommend') {
    // ok
  }

  const unique = [...new Set(issues)];

  return Object.freeze({
    ok: unique.length === 0 && decision === 'recommend',
    issues: Object.freeze(unique),
    decision,
    language,
  });
}
