/**
 * Story-Specific Discovery — find the specific micro-histories that make Black
 * history vivid at the neighborhood level (home "Beat 02 — One story + record
 * carousel").
 *
 * The methodology layers catalog-relative obscurity scoring (domain
 * `scoreObscurity` / `obscurityBand`) on top of theme-impact packet **Q4**
 * (place narrative — "for a specific formerly graded place, what followed for
 * the people who lived there?") to flag story-worthy candidates: leads that are
 * simultaneously obscure, geographically specific, and rich enough (multiple
 * life events / temporal depth / place connection) to carry a place-first
 * story. Selected candidates are routed to the story research pipeline through
 * the shared research-directive loop.
 *
 * INVARIANTS (ADR-009 and constitution):
 * - This module is a research-discovery methodology. It PROPOSES candidates and
 *   staged briefs only. It NEVER publishes, promotes, or writes to public
 *   projections / release tables.
 * - Network I/O only ever happens through the injected `@repo/security`
 *   safe-fetch path that `research-directive.ts` already owns; this module does
 *   not open sockets itself.
 * - Scoring functions are PURE (no I/O, no side effects) so runs are replayable
 *   and auditable.
 * - `research-directive.ts` is imported and CALLED, never modified.
 */
import {
  geographicSpecificityRaw,
  type DiscoveryCandidateRecord,
  type ObscurityAssessment,
  type ThemeImpactThemeId,
} from '@repo/domain';
import {
  createTargetedBriefHandlers,
  runResearchDirective,
  type ResearchDirectiveContext,
  type ResearchDirectiveHandlers,
  type ResearchDirectiveRunResult,
  type TargetedBriefDecision,
  type TargetedBriefExtracted,
  type TargetedBriefSubject,
} from './research-directive.js';

export const STORY_WORTHINESS_METHODOLOGY_VERSION = 'story-worthiness.v1' as const;

/**
 * Public-safe disclaimer. Mirrors the obscurity heuristic's posture: a high
 * story-worthiness score means a lead *looks* like it could carry a place-first
 * micro-history — not that the story is true, complete, or approved to publish.
 */
export const STORY_WORTHINESS_METHODOLOGY_DISCLAIMER = {
  id: 'methodology_story_worthiness_heuristic_v1',
  title: 'About story-worthiness scores',
  reviewDate: '2026-07-24',
  body:
    'Story-worthiness is a relative routing heuristic that combines catalog-relative obscurity ' +
    'with geographic specificity and narrative-potential signals (multiple life events, temporal ' +
    'depth, place connection). A high score flags a lead as a candidate for the story research ' +
    'pipeline — it does not assert the story is true, complete, or important, and it never ' +
    'authorizes publication. Evidence before assertion still applies at every downstream gate.',
} as const;

/**
 * Weights (sum = 1) for the composite story-worthiness score:
 *
 *   S = clip01( w_o·O + w_g·G + w_n·N )
 *
 * O = catalog-relative obscurity (reuses the obscurity assessment score),
 * G = geographic specificity (reuses domain `geographicSpecificityRaw`),
 * N = narrative potential (multiple life events + temporal depth + place link).
 *
 * Obscurity and place carry the methodology's identity; narrative potential is
 * weighted highest because a story needs *material* — an obscure pin with a
 * single undated mention is not yet a story.
 */
export const STORY_WORTHINESS_WEIGHTS = {
  obscurity: 0.35,
  geographicSpecificity: 0.25,
  narrativePotential: 0.4,
} as const;

/** Minimum distinct life events for the "multiple life events" story gate. */
export const STORY_MULTIPLE_EVENTS_MIN = 2 as const;

/** Years of temporal spread that saturate the temporal-depth signal. */
export const STORY_TEMPORAL_DEPTH_SATURATION_YEARS = 40 as const;

export type StoryWorthinessFactorId =
  | 'obscurity'
  | 'geographic_specificity'
  | 'narrative_potential';

export type StoryWorthinessFactorBreakdown = {
  readonly factor: StoryWorthinessFactorId;
  /** Contribution after weight. */
  readonly weighted: number;
  /** Raw factor in [0, 1] before weight. */
  readonly raw: number;
  readonly rationale: string;
};

/** Hard conjunction gates: a lead is story-worthy only when all three pass. */
export type StoryWorthinessGates = {
  /** Obscurity band is `obscure` or `highly_obscure`. */
  readonly obscure: boolean;
  /** A city- or region-level geographic hint is present (Q4 place narrative). */
  readonly geographicallySpecific: boolean;
  /** At least `STORY_MULTIPLE_EVENTS_MIN` distinct life events. */
  readonly multipleLifeEvents: boolean;
};

export type StoryWorthinessBand =
  | 'strong_story'
  | 'candidate_story'
  | 'weak_story'
  | 'not_story';

export type StoryWorthinessAssessment = {
  readonly methodologyVersion: typeof STORY_WORTHINESS_METHODOLOGY_VERSION;
  readonly candidateId: string;
  /** Composite score in [0, 1] for ranking. */
  readonly score: number;
  /** Discrete band for UI / queue routing (independent of the hard gates). */
  readonly band: StoryWorthinessBand;
  /**
   * True only when every gate in `gates` passes. This — not the score — is what
   * `selectStoryCandidates` filters on: the methodology explicitly requires
   * obscure + geographically specific + multiple life events.
   */
  readonly storyWorthy: boolean;
  readonly gates: StoryWorthinessGates;
  readonly factors: readonly StoryWorthinessFactorBreakdown[];
  readonly rationale: string;
  readonly disclaimerId: typeof STORY_WORTHINESS_METHODOLOGY_DISCLAIMER.id;
  readonly assessedAt: string;
};

function clip01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function payloadOf(candidate: DiscoveryCandidateRecord): Readonly<Record<string, unknown>> {
  const payload = candidate.adapterRecord.payload;
  return isRecord(payload) ? payload : {};
}

/** Reads a plausible year from a value (number or 4-digit string). */
function coerceYear(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const match = value.match(/\b(1[5-9]\d{2}|20\d{2})\b/u);
    if (match) return Number(match[0]);
  }
  return undefined;
}

/**
 * Counts distinct life events on the candidate payload. Accepts `lifeEvents`
 * or `events` arrays (of strings or `{ label|type|year }` objects).
 */
export function lifeEventCount(candidate: DiscoveryCandidateRecord): number {
  const payload = payloadOf(candidate);
  const raw = payload.lifeEvents ?? payload.events;
  if (!Array.isArray(raw)) return 0;
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const key = entry.trim().toLowerCase();
      if (key) seen.add(key);
    } else if (isRecord(entry)) {
      const label =
        (typeof entry.label === 'string' && entry.label) ||
        (typeof entry.type === 'string' && entry.type) ||
        (typeof entry.kind === 'string' && entry.kind) ||
        '';
      const year = coerceYear(entry.year ?? entry.date);
      const key = `${label.trim().toLowerCase()}|${year ?? ''}`;
      if (key !== '|') seen.add(key);
    }
  }
  return seen.size;
}

/**
 * Temporal spread (in years) across the candidate's dated signals. Looks at
 * explicit span fields, birth/death years, and years embedded in life events.
 */
export function temporalDepthYears(candidate: DiscoveryCandidateRecord): {
  readonly spanYears: number;
  readonly hasTemporal: boolean;
} {
  const payload = payloadOf(candidate);
  const years: number[] = [];

  for (const key of ['yearStart', 'yearEnd', 'birthYear', 'deathYear', 'year']) {
    const year = coerceYear(payload[key]);
    if (year !== undefined) years.push(year);
  }

  const eventArrays = [payload.lifeEvents, payload.events];
  for (const arr of eventArrays) {
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      if (isRecord(entry)) {
        const year = coerceYear(entry.year ?? entry.date);
        if (year !== undefined) years.push(year);
      } else if (typeof entry === 'string') {
        const year = coerceYear(entry);
        if (year !== undefined) years.push(year);
      }
    }
  }

  if (years.length === 0) return { spanYears: 0, hasTemporal: false };
  const spanYears = Math.max(...years) - Math.min(...years);
  return { spanYears: Math.max(0, spanYears), hasTemporal: true };
}

/**
 * Narrative-potential raw signal N ∈ [0, 1]: mean of three sub-signals —
 * multiple life events, temporal depth, and place connection. This is the
 * "is there a story here?" factor beyond mere obscurity.
 */
export function narrativePotentialRaw(candidate: DiscoveryCandidateRecord): {
  readonly raw: number;
  readonly rationale: string;
  readonly events: number;
  readonly spanYears: number;
} {
  const events = lifeEventCount(candidate);
  const eventsRaw = clip01(events / 3);

  const { spanYears, hasTemporal } = temporalDepthYears(candidate);
  const temporalRaw = hasTemporal
    ? clip01(0.3 + (spanYears / STORY_TEMPORAL_DEPTH_SATURATION_YEARS) * 0.7)
    : 0;

  const hints = candidate.geographicHints;
  const payload = payloadOf(candidate);
  const hasPlaceLabel = typeof payload.placeLabel === 'string' && payload.placeLabel.trim() !== '';
  const hasSpecificHint = hints.some((hint) => hint.kind === 'city' || hint.kind === 'region');
  const placeRaw = hasSpecificHint || hasPlaceLabel ? 1 : hints.length > 0 ? 0.5 : 0;

  const raw = clip01((eventsRaw + temporalRaw + placeRaw) / 3);
  return {
    raw,
    events,
    spanYears,
    rationale: `${events} life event(s), temporal span ${spanYears}y (${
      hasTemporal ? 'dated' : 'undated'
    }), place ${hasSpecificHint ? 'city/region' : hasPlaceLabel ? 'labeled' : hints.length > 0 ? 'coarse' : 'none'}.`,
  };
}

export function storyWorthinessBand(score: number): StoryWorthinessBand {
  if (score >= 0.7) return 'strong_story';
  if (score >= 0.5) return 'candidate_story';
  if (score >= 0.3) return 'weak_story';
  return 'not_story';
}

/**
 * Score one discovery candidate for story-worthiness. PURE — no I/O.
 *
 * Combines the supplied obscurity assessment (catalog-relative obscurity band +
 * score), geographic specificity, and narrative potential into a composite
 * score, and evaluates the three hard gates that define a story-worthy lead.
 */
export function scoreStoryWorthiness(
  candidate: DiscoveryCandidateRecord,
  obscurity: ObscurityAssessment,
  assessedAt: string = obscurity.assessedAt,
): StoryWorthinessAssessment {
  const geo = geographicSpecificityRaw(candidate);
  const narrative = narrativePotentialRaw(candidate);

  const factors: StoryWorthinessFactorBreakdown[] = [
    {
      factor: 'obscurity',
      raw: obscurity.score,
      weighted: STORY_WORTHINESS_WEIGHTS.obscurity * obscurity.score,
      rationale: `Obscurity band ${obscurity.band} (score ${obscurity.score.toFixed(3)}).`,
    },
    {
      factor: 'geographic_specificity',
      raw: geo.raw,
      weighted: STORY_WORTHINESS_WEIGHTS.geographicSpecificity * geo.raw,
      rationale: geo.rationale,
    },
    {
      factor: 'narrative_potential',
      raw: narrative.raw,
      weighted: STORY_WORTHINESS_WEIGHTS.narrativePotential * narrative.raw,
      rationale: narrative.rationale,
    },
  ];

  const score = clip01(
    Number(factors.reduce((sum, factor) => sum + factor.weighted, 0).toFixed(4)),
  );

  const gates: StoryWorthinessGates = {
    obscure: obscurity.band === 'obscure' || obscurity.band === 'highly_obscure',
    geographicallySpecific: candidate.geographicHints.some(
      (hint) => hint.kind === 'city' || hint.kind === 'region',
    ),
    multipleLifeEvents: narrative.events >= STORY_MULTIPLE_EVENTS_MIN,
  };
  const storyWorthy = gates.obscure && gates.geographicallySpecific && gates.multipleLifeEvents;

  const failed: string[] = [];
  if (!gates.obscure) failed.push(`not obscure (band ${obscurity.band})`);
  if (!gates.geographicallySpecific) failed.push('no city/region place hint');
  if (!gates.multipleLifeEvents) failed.push(`only ${narrative.events} life event(s)`);

  const rationale = storyWorthy
    ? `Story-worthy: obscure + geographically specific + ${narrative.events} life events; ` +
      `composite ${score.toFixed(3)} (${storyWorthinessBand(score)}).`
    : `Not story-worthy — ${failed.join('; ')}. Composite ${score.toFixed(3)}.`;

  return {
    methodologyVersion: STORY_WORTHINESS_METHODOLOGY_VERSION,
    candidateId: candidate.id,
    score,
    band: storyWorthinessBand(score),
    storyWorthy,
    gates,
    factors,
    rationale,
    disclaimerId: STORY_WORTHINESS_METHODOLOGY_DISCLAIMER.id,
    assessedAt,
  };
}

/** A discovery candidate paired with its already-computed obscurity assessment. */
export type StoryCandidateInput = {
  readonly candidate: DiscoveryCandidateRecord;
  readonly obscurity: ObscurityAssessment;
};

export type StorySelectedCandidate = {
  readonly candidate: DiscoveryCandidateRecord;
  readonly assessment: StoryWorthinessAssessment;
  /** Ready-to-run subject for the shared targeted-brief directive loop. */
  readonly subject: TargetedBriefSubject;
};

export type SelectStoryCandidatesOptions = {
  /** Timestamp stamped onto each assessment (defaults to each obscurity stamp). */
  readonly assessedAt?: string;
  /** When false, geography acts as a soft signal only (does not exclude). Default true. */
  readonly requireGeographyMatch?: boolean;
  /** When false, theme acts as a soft signal only (does not exclude). Default true. */
  readonly requireThemeMatch?: boolean;
};

export type SelectStoryCandidatesResult = {
  readonly kind: 'story.candidate.selection.v1';
  readonly theme: ThemeImpactThemeId;
  readonly geography: string;
  readonly consideredCount: number;
  readonly selected: readonly StorySelectedCandidate[];
  readonly rejectedCount: number;
};

function candidateText(candidate: DiscoveryCandidateRecord): string {
  const payload = payloadOf(candidate);
  const summary = typeof payload.summary === 'string' ? payload.summary : '';
  return `${candidate.adapterRecord.title ?? ''} ${summary}`.toLowerCase();
}

/**
 * Loose theme match. A candidate matches a theme when the theme id (or its
 * space-separated form) appears in an explicit `theme` / `themes` payload field,
 * in the candidate's discovery signal terms/classes, or in its title/summary.
 */
export function candidateMatchesTheme(
  candidate: DiscoveryCandidateRecord,
  theme: ThemeImpactThemeId,
): boolean {
  const payload = payloadOf(candidate);
  const needleId = theme.toLowerCase();
  const needleWords = theme.replace(/_/g, ' ').toLowerCase();

  if (typeof payload.theme === 'string' && payload.theme.toLowerCase() === needleId) return true;
  if (Array.isArray(payload.themes)) {
    for (const entry of payload.themes) {
      if (typeof entry === 'string' && entry.toLowerCase() === needleId) return true;
    }
  }

  const signalHaystack = [
    ...candidate.signals.matchedClasses,
    ...candidate.signals.matchedTerms,
  ]
    .join(' ')
    .toLowerCase();
  if (signalHaystack.includes(needleId) || signalHaystack.includes(needleWords)) return true;

  const text = candidateText(candidate);
  return text.includes(needleWords);
}

/**
 * Loose geography match. Empty geography matches everything. Otherwise the
 * geography string must appear in a geographic hint, the `placeLabel` payload
 * field, or the candidate title/summary (case-insensitive).
 */
export function candidateMatchesGeography(
  candidate: DiscoveryCandidateRecord,
  geography: string,
): boolean {
  const needle = geography.trim().toLowerCase();
  if (needle === '') return true;

  if (candidate.geographicHints.some((hint) => hint.text.toLowerCase().includes(needle))) {
    return true;
  }
  const payload = payloadOf(candidate);
  if (typeof payload.placeLabel === 'string' && payload.placeLabel.toLowerCase().includes(needle)) {
    return true;
  }
  return candidateText(candidate).includes(needle);
}

/** Extracts candidate URLs from `canonicalUrl` and common payload url fields. */
function candidateSeedUrls(candidate: DiscoveryCandidateRecord): readonly string[] {
  const urls: string[] = [];
  const canonical = candidate.adapterRecord.canonicalUrl;
  if (typeof canonical === 'string' && canonical.trim()) urls.push(canonical.trim());

  const payload = payloadOf(candidate);
  const candidateUrl = payload.url ?? payload.sourceUrl ?? payload.primaryUrl;
  if (typeof candidateUrl === 'string' && candidateUrl.trim()) urls.push(candidateUrl.trim());

  const leadUrls = payload.authorityLeadUrls ?? payload.leadUrls;
  if (Array.isArray(leadUrls)) {
    for (const entry of leadUrls) {
      if (typeof entry === 'string' && entry.trim()) urls.push(entry.trim());
    }
  }

  return [...new Set(urls)];
}

/** Builds the targeted-brief subject that hands a selected candidate to the loop. */
export function buildStoryBriefSubject(
  candidate: DiscoveryCandidateRecord,
  theme: ThemeImpactThemeId,
  geography: string,
): TargetedBriefSubject {
  const payload = payloadOf(candidate);
  const title = candidate.adapterRecord.title ?? candidate.identity.stableIdentifier;
  const placeLabel =
    (typeof payload.placeLabel === 'string' && payload.placeLabel.trim()) ||
    candidate.geographicHints.find((hint) => hint.kind === 'city' || hint.kind === 'region')?.text ||
    geography ||
    'Place TBD';
  const seedUrls = candidateSeedUrls(candidate);
  const themeWords = theme.replace(/_/g, ' ');

  return {
    briefId: `story-${theme}-${candidate.id}`,
    title,
    placeLabel,
    ...(seedUrls.length > 0 ? { seedUrls } : {}),
    searchQueries: [`${title} ${placeLabel} ${themeWords} history`.replace(/\s+/gu, ' ').trim()],
  };
}

/**
 * Filter a pool of obscurity-scored candidates down to the story-worthy set for
 * a theme + geography, and shape each survivor into a targeted-brief subject
 * ready for the story research gather stage. PURE — no I/O.
 */
export function selectStoryCandidates(
  candidates: readonly StoryCandidateInput[],
  theme: ThemeImpactThemeId,
  geography: string,
  options: SelectStoryCandidatesOptions = {},
): SelectStoryCandidatesResult {
  const requireTheme = options.requireThemeMatch ?? true;
  const requireGeo = options.requireGeographyMatch ?? true;

  const selected: StorySelectedCandidate[] = [];
  for (const input of candidates) {
    const assessment = scoreStoryWorthiness(
      input.candidate,
      input.obscurity,
      options.assessedAt ?? input.obscurity.assessedAt,
    );
    if (!assessment.storyWorthy) continue;
    if (requireTheme && !candidateMatchesTheme(input.candidate, theme)) continue;
    if (requireGeo && !candidateMatchesGeography(input.candidate, geography)) continue;

    selected.push({
      candidate: input.candidate,
      assessment,
      subject: buildStoryBriefSubject(input.candidate, theme, geography),
    });
  }

  selected.sort(
    (left, right) =>
      right.assessment.score - left.assessment.score ||
      left.candidate.id.localeCompare(right.candidate.id),
  );

  return {
    kind: 'story.candidate.selection.v1',
    theme,
    geography,
    consideredCount: candidates.length,
    selected,
    rejectedCount: candidates.length - selected.length,
  };
}

export type StoryGapDiscoveryBrief = {
  readonly candidateId: string;
  readonly assessment: StoryWorthinessAssessment;
  readonly subject: TargetedBriefSubject;
  readonly decision: TargetedBriefDecision;
  readonly run: ResearchDirectiveRunResult<
    TargetedBriefSubject,
    TargetedBriefExtracted,
    TargetedBriefDecision
  >;
};

export type RunStoryGapDiscoveryInput = {
  readonly theme: ThemeImpactThemeId;
  readonly geography: string;
  /**
   * Obscurity-scored candidates to consider. Fixture-first, like the other
   * campaign runners: a discovery campaign produces + obscurity-scores
   * candidates upstream, and they are handed in here (or supplied lazily via
   * `discover`). This module performs no discovery network I/O of its own.
   */
  readonly candidates?: readonly StoryCandidateInput[];
  /** Optional lazy source of candidates (still bounded, still injected fetch). */
  readonly discover?: () => Promise<readonly StoryCandidateInput[]> | readonly StoryCandidateInput[];
  readonly nowIso: string;
  /** Cap on how many story briefs to run through the directive loop. */
  readonly maxBriefs?: number;
  readonly selectionOptions?: SelectStoryCandidatesOptions;
  /** Context passed to the shared directive loop (safe-fetch deps, concurrency). */
  readonly directiveContext?: ResearchDirectiveContext;
  /**
   * Handlers for the directive loop. Defaults to the shared
   * `createTargetedBriefHandlers()` — override only for testing (e.g. to inject
   * a fixture gather). `research-directive.ts` is never modified.
   */
  readonly directiveHandlers?: ResearchDirectiveHandlers<
    TargetedBriefSubject,
    TargetedBriefExtracted,
    TargetedBriefDecision
  >;
};

export type StoryGapDiscoveryResult = {
  readonly kind: 'story.gap.discovery.v1';
  readonly theme: ThemeImpactThemeId;
  readonly geography: string;
  readonly consideredCount: number;
  readonly selectedCount: number;
  readonly briefedCount: number;
  readonly briefs: readonly StoryGapDiscoveryBrief[];
  readonly disclaimerId: typeof STORY_WORTHINESS_METHODOLOGY_DISCLAIMER.id;
  readonly completedAt: string;
};

/**
 * Orchestrate one story-gap discovery pass for a theme + priority geography:
 *
 *   discover/ingest → score (story-worthiness) → select → hand off to the shared
 *   targeted-brief directive loop (plan → gather → extract → decide).
 *
 * Reuses `research-directive.ts` by importing and calling
 * `createTargetedBriefHandlers` + `runResearchDirective`; that module is not
 * modified. Nothing here publishes — the loop can only stage_for_review / hold /
 * reject, feeding the existing quarantine → judge pipeline.
 */
export async function runStoryGapDiscovery(
  input: RunStoryGapDiscoveryInput,
): Promise<StoryGapDiscoveryResult> {
  const sourced = input.discover ? await input.discover() : input.candidates ?? [];
  const selection = selectStoryCandidates(sourced, input.theme, input.geography, {
    assessedAt: input.nowIso,
    ...input.selectionOptions,
  });

  const chosen =
    input.maxBriefs !== undefined
      ? selection.selected.slice(0, Math.max(0, input.maxBriefs))
      : selection.selected;

  const handlers = input.directiveHandlers ?? createTargetedBriefHandlers();
  const context = input.directiveContext ?? {};

  const briefs: StoryGapDiscoveryBrief[] = [];
  for (const item of chosen) {
    const run = await runResearchDirective(item.subject, handlers, context);
    briefs.push({
      candidateId: item.candidate.id,
      assessment: item.assessment,
      subject: item.subject,
      decision: run.decision,
      run,
    });
  }

  return {
    kind: 'story.gap.discovery.v1',
    theme: input.theme,
    geography: input.geography,
    consideredCount: selection.consideredCount,
    selectedCount: selection.selected.length,
    briefedCount: briefs.length,
    briefs,
    disclaimerId: STORY_WORTHINESS_METHODOLOGY_DISCLAIMER.id,
    completedAt: input.nowIso,
  };
}
