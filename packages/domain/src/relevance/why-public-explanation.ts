/**
 * "Why this appears" public composer. The single place that assembles relevance
 * evidence/prose (`./why.js`, `./public.js`) and notabilityBasis (`../entity-status.js`) into
 * the one auditable, per-entity payload apps/web's `<WhyThisAppears>` component renders. Composes
 * `./why-public-dimensions.js`, `./why-public-editorial.js`, `./why-public-notice.js`,
 * `./why-public-missing-perspective.js`, and `./why-public-basis.js` — it introduces no new
 * relevance gate and rewrites none of `./engine.js` or `./gates.js`.
 *
 * Enforces these invariants structurally, not only by prose review:
 * `assertSubstantiveConnectionExplained` — every entity explains its substantive connection.
 * `assertReasonNotIdentityAttendanceOrJobAlone` — race/fame/attendance/employment/residence
 * alone is never presented as the reason (the deeper structural guarantee is the closed
 * `NOTABILITY_CRITERIA` vocabulary itself — see `../entity-status.js` — which contains no
 * criterion reducible to a bare identity attribute; this is the additional prose-level guard).
 * `assertResultsNotViolenceOnlyCollapse` (`./why-public-dimensions.js`) — result-SET level.
 * `assertExplanationDerivesFromAcceptedEvidence` — explanations derive from accepted evidence.
 * `assertPublicNotabilityBasisNeverScored` (`./why-public-basis.js`) + the final numeric-leaf
 * sweep below — notabilityBasis renders in approved language, auditable, never a score.
 */
import type { RelevanceEvidence } from './types.js';
import type { NotabilityBasisRecord } from '../entity-status.js';
import { hasRequiredNotabilityBasis } from '../entity-status.js';
import { assertNoPassiveEuphemisms } from './why-public-editorial.js';
import { classifyStoryDimensions, type StoryDimension } from './why-public-dimensions.js';
import {
  deriveTraumaContentNotice,
  type TraumaContentNoticeDecision,
} from './why-public-notice.js';
import {
  deriveMissingPerspectiveIndicators,
  type MissingPerspectiveIndicator,
} from './why-public-missing-perspective.js';
import {
  buildPublicNotabilityBasis,
  assertPublicNotabilityBasisNeverScored,
  type PublicNotabilityBasisItem,
} from './why-public-basis.js';

export type PublicWhyThisAppearsInput = {
  /** Public-safe prose typically `buildWhyThisAppears`'s output (./why.js) or an entity's
   * `relevanceExplanation` field. Never a numeric-score-bearing string. */
  readonly explanation: string;
  /** Accepted relevance evidence backing the explanation. */
  readonly evidence: readonly RelevanceEvidence[];
  /** structured inclusion basis. */
  readonly notabilityBasis: readonly NotabilityBasisRecord[] | undefined;
  /** Additional accepted prose (claim summaries, historical-context copy) to classify into story
   * dimensions alongside `explanation` never new, unsourced text invented by this module. */
  readonly storyTexts?: readonly string[];
};

export type PublicWhyThisAppears = {
  readonly explanation: string;
  readonly notabilityBasis: readonly PublicNotabilityBasisItem[];
  readonly storyDimensions: readonly StoryDimension[];
  readonly missingPerspectiveIndicators: readonly MissingPerspectiveIndicator[];
  readonly traumaContentNotice: TraumaContentNoticeDecision;
};

const MIN_EXPLANATION_LENGTH = 20;

/** every entity explains its substantive connection composes own
 * `hasRequiredNotabilityBasis` gate rather than re-deriving the >=1-record rule. */
export function assertSubstantiveConnectionExplained(input: {
  readonly explanation: string;
  readonly notabilityBasis: readonly NotabilityBasisRecord[] | undefined;
}): void {
  if (input.explanation.trim().length < MIN_EXPLANATION_LENGTH) {
    throw new Error(
      'Public "why this appears" explanation is missing or too short to describe a substantive connection.',
    );
  }
  if (!hasRequiredNotabilityBasis(input.notabilityBasis)) {
    throw new Error(
      'Public "why this appears" explanation requires at least one notabilityBasis record ' +
        'to substantiate the entity\u2019s connection — an explanation alone is not sufficient.',
    );
  }
}

/**
 * a Black person's race, fame, attendance, employment, or residence alone is never presented
 * as the reason. Non-exhaustive prose-level guard, extended as editorial review finds new phrasing
 * the deeper structural guarantee is closed `NOTABILITY_CRITERIA` vocabulary itself
 * (../entity-status.js), none of whose 8 values reduces to a bare identity attribute.
 */
const INSUFFICIENT_STANDALONE_REASON_PHRASES = [
  'because they are black',
  'because he is black',
  'because she is black',
  'simply because of their race',
  'solely because of their race',
  'because of their fame alone',
  'famous alone',
  'simply attended',
  'merely attended',
  'simply worked at',
  'merely employed at',
  'simply lived at',
  'simply resided at',
  'merely resided in',
  'just for being black',
] as const;

export function assertReasonNotIdentityAttendanceOrJobAlone(explanation: string): void {
  const normalized = explanation.toLowerCase();
  for (const phrase of INSUFFICIENT_STANDALONE_REASON_PHRASES) {
    if (normalized.includes(phrase)) {
      throw new Error(
        `Public "why this appears" explanation must never present race, fame, attendance, ` +
          `employment, or residence alone as the reason for inclusion (found "${phrase}").`,
      );
    }
  }
}

/** explanations derive from accepted relevance evidence mirrors./why.js's own
 * `joinEvidenceSummaries` filter (a `gate`-kind entry alone is a rejection record, not evidence). */
export function assertExplanationDerivesFromAcceptedEvidence(
  evidence: readonly RelevanceEvidence[],
): void {
  const hasSubstantiveEvidence = evidence.some((entry) => entry.kind !== 'gate');
  if (!hasSubstantiveEvidence) {
    throw new Error(
      'Public "why this appears" explanation requires at least one substantive (non-gate) ' +
        'accepted relevance evidence entry.',
    );
  }
}

/** Final defense-in-depth sweep: throws if any numeric leaf ever appears in the composed public
 * payload, mirroring ./notability-gate.test.ts's own `assertNoNumericLeaf` check. */
function assertNoNumericLeaf(value: unknown, path = '$'): void {
  if (typeof value === 'number') {
    throw new Error(
      `Public "why this appears" payload must never expose a number (found at ${path}).`,
    );
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoNumericLeaf(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      assertNoNumericLeaf(entry, `${path}.${key}`);
    }
  }
}

/**
 * Composes the full public "why this appears" payload, enforcing structurally
 * (throws rather than silently rendering non-compliant content). is enforced at the result-SET
 * level by./why-public-dimensions.js's `assertResultsNotViolenceOnlyCollapse`, which callers
 * rendering multiple entities together should also invoke over the returned `storyDimensions`.
 */
export function buildPublicWhyThisAppears(input: PublicWhyThisAppearsInput): PublicWhyThisAppears {
  const storyTexts = input.storyTexts ?? [];
  for (const text of [input.explanation, ...storyTexts]) {
    assertNoPassiveEuphemisms(text);
  }
  assertSubstantiveConnectionExplained(input);
  assertReasonNotIdentityAttendanceOrJobAlone(input.explanation);
  assertExplanationDerivesFromAcceptedEvidence(input.evidence);

  const storyDimensions = classifyStoryDimensions([input.explanation, ...storyTexts]);
  const notabilityBasis = buildPublicNotabilityBasis(input.notabilityBasis);
  assertPublicNotabilityBasisNeverScored(notabilityBasis);

  const result: PublicWhyThisAppears = {
    explanation: input.explanation,
    notabilityBasis,
    storyDimensions,
    missingPerspectiveIndicators: deriveMissingPerspectiveIndicators(storyDimensions),
    traumaContentNotice: deriveTraumaContentNotice(storyDimensions),
  };

  assertNoNumericLeaf(result);
  return result;
}
