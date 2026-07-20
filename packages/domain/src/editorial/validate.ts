/**
 * Editorial draft validation: learning-index summary contract and public-language
 * procedural-status gates over stripped prose-link markup.
 */
import { evaluatePublicLanguage, type PublicLanguageEvaluation } from '../confidence-engine/index.js';
import {
  validateLearningSummary,
  type LearningIndexContractIssue,
} from '../learning-index/index.js';
import { isValidTopicId } from '../taxonomy/topics.js';
import { stripProseEntityLinks } from './prose-links.js';
import type { EditorialClaimDraft, EditorialFieldDraft } from './packet.js';

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
    // `EditorialFieldDraft` is filled from free-model JSON — a field the type says is
    // `string` can arrive as `null` or another JSON type at runtime. A validator must
    // never throw on malformed input, so check the real type before calling `.trim()`.
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

const CLAIM_CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low']);
const ERA_BUCKET_PATTERN = /^\d{3,4}s$/u;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateClaimDraft(claim: EditorialClaimDraft, index: number, issues: string[]): void {
  if (!isNonEmptyString(claim.predicate)) issues.push(`claims[${index}]: predicate is empty`);
  if (!isNonEmptyString(claim.object)) issues.push(`claims[${index}]: object is empty`);
  if (!CLAIM_CONFIDENCE_LEVELS.has(claim.confidenceLevel)) {
    issues.push(`claims[${index}]: confidenceLevel must be high|medium|low`);
  }
  if (!isNonEmptyString(claim.citationSource) || !isNonEmptyString(claim.citationLabel)) {
    issues.push(`claims[${index}]: citationSource and citationLabel are required`);
  }
  if (typeof claim.citationHref !== 'string' || !/^https?:\/\//u.test(claim.citationHref)) {
    issues.push(`claims[${index}]: citationHref must be an http(s) URL`);
  }
}

/** Validates editorial draft fields; never throws. */
export function validateEditorialDrafts(
  drafts: EditorialFieldDraft,
  options: {
    /** When provided, every claim citationHref must be one of these judge-supplied URLs. */
    readonly allowedCitationHrefs?: readonly string[];
  } = {},
): EditorialDraftValidation {
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

  if (Array.isArray(drafts.topicIds)) {
    for (const topicId of drafts.topicIds) {
      if (!isNonEmptyString(topicId) || !isValidTopicId(topicId)) {
        issues.push(`topicIds: "${String(topicId)}" is not a registered topic id`);
      }
    }
  }
  if (Array.isArray(drafts.eraBuckets)) {
    for (const bucket of drafts.eraBuckets) {
      if (!isNonEmptyString(bucket) || !ERA_BUCKET_PATTERN.test(bucket)) {
        issues.push(`eraBuckets: "${String(bucket)}" is not a decade bucket like "1910s"`);
      }
    }
  }
  if (Array.isArray(drafts.claims)) {
    const allowed = options.allowedCitationHrefs
      ? new Set(options.allowedCitationHrefs.filter(isNonEmptyString).map((href) => href.trim()))
      : undefined;
    drafts.claims.forEach((claim, index) => {
      validateClaimDraft(claim, index, issues);
      if (allowed && isNonEmptyString(claim.citationHref) && !allowed.has(claim.citationHref.trim())) {
        issues.push(
          `claims[${index}]: citationHref is not one of the judge-supplied source URLs (possible fabrication)`,
        );
      }
    });
  }

  return Object.freeze({
    ok: issues.length === 0,
    issues,
    ...(language !== undefined ? { language } : {}),
    ...(learningSummary !== undefined ? { learningSummary } : {}),
  });
}
