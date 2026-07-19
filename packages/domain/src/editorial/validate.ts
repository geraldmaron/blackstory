/**
 * Editorial draft validation: learning-index summary contract and public-language
 * procedural-status gates over stripped prose-link markup.
 */
import { evaluatePublicLanguage, type PublicLanguageEvaluation } from '../confidence-engine/index.js';
import {
  validateLearningSummary,
  type LearningIndexContractIssue,
} from '../learning-index/index.js';
import { stripProseEntityLinks } from './prose-links.js';
import type { EditorialFieldDraft } from './packet.js';

/** Safe constitution vocabulary pair for editorial summary language checks. */
export const EDITORIAL_LANGUAGE_PROCEDURAL_STATUS = 'ruled' as const;

export type EditorialDraftValidation = {
  readonly ok: boolean;
  readonly issues: readonly string[];
  readonly language?: PublicLanguageEvaluation;
  readonly learningSummary?: readonly LearningIndexContractIssue[];
};

function collectDraftText(drafts: EditorialFieldDraft): readonly string[] {
  return [
    drafts.publicSummary,
    drafts.historicalContext,
    drafts.identityLabel,
    drafts.relevanceNote,
    drafts.proposedRelationshipNotes,
  ].filter((value): value is string => value !== undefined && value.trim().length > 0);
}

/** Validates editorial draft fields; never throws. */
export function validateEditorialDrafts(drafts: EditorialFieldDraft): EditorialDraftValidation {
  const issues: string[] = [];
  let language: PublicLanguageEvaluation | undefined;
  let learningSummary: readonly LearningIndexContractIssue[] | undefined;

  if (drafts.publicSummary !== undefined) {
    const strippedSummary = stripProseEntityLinks(drafts.publicSummary);
    learningSummary = validateLearningSummary(strippedSummary);
    for (const issue of learningSummary) {
      issues.push(issue.message);
    }

    language = evaluatePublicLanguage({
      text: strippedSummary,
      requestedProceduralStatus: EDITORIAL_LANGUAGE_PROCEDURAL_STATUS,
      evidenceProceduralStatus: EDITORIAL_LANGUAGE_PROCEDURAL_STATUS,
    });
    for (const violation of language.violations) {
      issues.push(violation);
    }
  }

  for (const fieldText of collectDraftText(drafts)) {
    if (fieldText === drafts.publicSummary) continue;
    const stripped = stripProseEntityLinks(fieldText);
    const evaluation = evaluatePublicLanguage({
      text: stripped,
      requestedProceduralStatus: EDITORIAL_LANGUAGE_PROCEDURAL_STATUS,
      evidenceProceduralStatus: EDITORIAL_LANGUAGE_PROCEDURAL_STATUS,
    });
    for (const violation of evaluation.violations) {
      issues.push(violation);
    }
  }

  return Object.freeze({
    ok: issues.length === 0,
    issues,
    ...(language !== undefined ? { language } : {}),
    ...(learningSummary !== undefined ? { learningSummary } : {}),
  });
}
