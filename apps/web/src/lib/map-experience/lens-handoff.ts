/**
 * The Lens handoff builder — the one typed path a reading room uses to hand a subject to
 * Explore (docs/ui/patterns-lens-handoff.md §1-2). No surface hand writes an Explore href: a hand
 * written one drifts from `EXPLORE_URL_PARAM_KEYS` the moment that allowlist changes, and the
 * reader silently loses whatever param the middleware does not recognise.
 *
 * `/law` and `/law/[slug]` are this module's first two consumers (SP-11d, SP-12c). Both need a
 * reason string that names jurisdiction and era without asserting the archive documented cause
 * and effect between them — see §1: "A reason string that implies causation the archive has not
 * documented fails the type." TypeScript has no literal-content type for prose, so the type is
 * enforced the only way a string's content can be: a runtime refusal, asserted by
 * `lens-handoff.test.ts`.
 */
import { DEFAULT_EXPLORE_FILTERS, type ExploreFilterState } from './filters';
import { buildExploreHref, defaultExploreOverlayState, type ExploreViewState } from './url-state';

export type LensHandoffSubject = {
  readonly kind?: string;
  readonly era?: string;
  readonly theme?: string;
  readonly status?: string;
  readonly confidence?: string;
  readonly tone?: string;
  readonly state?: string;
  readonly selected?: string;
  readonly decade?: string;
};

export type LensHandoff = {
  readonly href: string;
  readonly reason: string;
};

/**
 * Thrown when a caller hands the builder a reason string that asserts cause and effect. The
 * archive documents a jurisdiction, an era, a topic — never that one caused another.
 */
export class CausalReasonStringError extends Error {
  constructor(reason: string) {
    super(
      `Lens handoff reason string implies causation the archive has not documented: "${reason}"`,
    );
    this.name = 'CausalReasonStringError';
  }
}

/**
 * Words and phrases that assert a causal claim. Deliberately narrow: the goal is to catch the
 * pattern documented in the law ("records here because X happened"), not to police every use of
 * these words in an unrelated sense, so the list stays short and reviewed rather than growing
 * into a general-purpose banned-word filter.
 */
const CAUSAL_PHRASES: readonly string[] = [
  'because',
  'caused by',
  'causes',
  'causing',
  'due to',
  'led to',
  'leads to',
  'leading to',
  'as a result of',
  'resulted in',
  'results in',
  'so that',
  'therefore',
  'consequently',
  'in response to',
];

function assertNotCausal(reason: string): void {
  const lower = reason.toLowerCase();
  for (const phrase of CAUSAL_PHRASES) {
    if (lower.includes(phrase)) throw new CausalReasonStringError(reason);
  }
}

/**
 * Builds an Explore deep link plus the mandatory reason string the results header renders. The
 * href always goes through `buildExploreHref`, so it can never emit a param outside
 * `EXPLORE_URL_PARAM_KEYS` and can never carry a viewport key (ADR-017).
 */
export function buildLensHandoff(subject: LensHandoffSubject, reason: string): LensHandoff {
  assertNotCausal(reason);

  const filters: ExploreFilterState = {
    ...DEFAULT_EXPLORE_FILTERS,
    ...(subject.kind ? { kind: subject.kind } : {}),
    ...(subject.era ? { era: subject.era } : {}),
    ...(subject.theme ? { theme: subject.theme } : {}),
    ...(subject.status ? { status: subject.status } : {}),
    ...(subject.confidence ? { confidence: subject.confidence } : {}),
    ...(subject.tone ? { tone: subject.tone } : {}),
  };

  const viewState: ExploreViewState = {
    filters,
    ...defaultExploreOverlayState(),
    ...(subject.state ? { state: subject.state } : {}),
    ...(subject.selected ? { selected: subject.selected } : {}),
    ...(subject.decade ? { decade: subject.decade } : {}),
  };

  return { href: buildExploreHref(viewState), reason };
}
