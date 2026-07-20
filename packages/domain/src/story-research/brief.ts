/**
 * Story research brief: the ten structural moves extracted from citation-safe
 * longform methodology (thesis, start-line relocation, anchors, mechanisms).
 *
 * These slots capture how a story links information — not viral rhetorical voice.
 */

/** One parallel case used to show the same structure across place or time. */
export type PatternCase = {
  readonly label: string;
  readonly placeLabel?: string;
  readonly whenLabel?: string;
  readonly structuralParallel: string;
};

export type MechanismKind = 'legal' | 'economic' | 'institutional' | 'psychological';

export type MechanismLayer = {
  readonly kind: MechanismKind;
  readonly summary: string;
};

/**
 * Structured research brief. Framing fields may be empty during harvest;
 * recommend requires thesis + start-line relocation at minimum.
 */
export type StoryResearchBrief = {
  /** One sentence the story answers. */
  readonly thesisQuestion: string;
  /** What popular memory / school narrative usually starts with. */
  readonly conventionalStartLine: string;
  /** Where the archive actually begins (checkable origin). */
  readonly relocatedStartLine: string;
  /** Legal / economic / institutional why — not vibes. */
  readonly mechanismLayers: readonly MechanismLayer[];
  /** Capped parallel cases (same structure, different locale or era). */
  readonly patternCases: readonly PatternCase[];
  /** Outcome document / statute / constitution that reveals intent. */
  readonly winnerBuiltTest?: {
    readonly outcomeDocument: string;
    readonly whatItProves: string;
  };
  /** Structural continuity to the present with a checkable off-ramp. */
  readonly presentBridge?: {
    readonly continuityClaim: string;
    readonly verificationOffRamp: string;
  };
  /** Reader-facing verification rule (e.g. watch votes, not props). */
  readonly verificationRule?: string;
};

export type BuildStoryResearchBriefInput = {
  readonly thesisQuestion: string;
  readonly conventionalStartLine: string;
  readonly relocatedStartLine: string;
  readonly mechanismLayers?: readonly MechanismLayer[];
  readonly patternCases?: readonly PatternCase[];
  readonly winnerBuiltTest?: StoryResearchBrief['winnerBuiltTest'];
  readonly presentBridge?: StoryResearchBrief['presentBridge'];
  readonly verificationRule?: string;
};

/** Pure builder; freezes arrays. */
export function buildStoryResearchBrief(input: BuildStoryResearchBriefInput): StoryResearchBrief {
  return Object.freeze({
    thesisQuestion: input.thesisQuestion.trim(),
    conventionalStartLine: input.conventionalStartLine.trim(),
    relocatedStartLine: input.relocatedStartLine.trim(),
    mechanismLayers: Object.freeze([...(input.mechanismLayers ?? [])]),
    patternCases: Object.freeze([...(input.patternCases ?? [])]),
    ...(input.winnerBuiltTest !== undefined
      ? { winnerBuiltTest: Object.freeze({ ...input.winnerBuiltTest }) }
      : {}),
    ...(input.presentBridge !== undefined
      ? { presentBridge: Object.freeze({ ...input.presentBridge }) }
      : {}),
    ...(input.verificationRule !== undefined
      ? { verificationRule: input.verificationRule.trim() }
      : {}),
  });
}
