<!--
  Methodology doc for Story-Specific Discovery: how BlackStory finds the specific
  micro-histories that make Black history vivid at the neighborhood level, by
  layering catalog-relative obscurity scoring on top of theme-impact Q4 (place
  narrative) and routing survivors to the story research pipeline.

  Research-discovery methodology only. Nothing here publishes (ADR-009).
-->

# Story-Specific Discovery

**Status:** Draft v1 (2026-07-24)
**Module:** `packages/operator-cli/src/story-gap-discovery.ts`
**Tests:** `packages/operator-cli/src/story-gap-discovery.test.ts`
**Companions:** [research-directive-framework.md](./research-directive-framework.md), [theme-impact-canonical-questions.md](./theme-impact-canonical-questions.md), [story-rewrite-review.md](./story-rewrite-review.md), `packages/domain/src/discovery/obscurity.ts`

## 1. Purpose

Most discovery lanes optimize for *coverage* (fill catalog gaps) or *obscurity*
(surface thinly-attested leads). Story-Specific Discovery optimizes for a
different target: the specific, place-pinned micro-histories that make Black
history **vivid at the neighborhood level** — the material behind the home
surface's **"Beat 02 — One story + record carousel"**.

It answers: *of the leads we could research, which ones look like they could
carry a place-first story about real people?* A lead is worth routing to the
story pipeline when it is simultaneously:

1. **Obscure** — catalog-relative, not already a well-attested figure (reuses the
   obscurity heuristic; `obscure` or `highly_obscure` band).
2. **Geographically specific** — a city/region place hint, which maps to
   theme-impact canonical question **Q4** ("for a specific formerly graded
   place, what followed for the people who lived there?" — `place_narrative`).
3. **Narratively rich** — multiple life events, temporal depth, and a place
   connection. An obscure pin with a single undated mention is not yet a story.

## 2. Invariants (non-negotiable)

- **Research workers cannot publish (ADR-009).** This module PROPOSES candidates
  and staged briefs only. It never writes to public projections / release tables
  and never promotes. The directive loop it hands off to can only
  `stage_for_review`, `hold`, or `reject`.
- **Safe-fetch only.** No network I/O originates in this module. All fetching
  happens through the injected `@repo/security` safe-fetch path that
  `research-directive.ts` already owns.
- **Evidence before assertion; dignity; living addresses never public.** A
  story-worthiness score is a *routing heuristic*, not a truth claim. See the
  public-safe disclaimer `methodology_story_worthiness_heuristic_v1`.
- **Pure scoring.** `scoreStoryWorthiness`, `selectStoryCandidates`, and their
  helpers are pure — no I/O, no side effects — so runs are replayable/auditable.
- `research-directive.ts` is **imported and called, never modified.**

## 3. Scoring model

`scoreStoryWorthiness(candidate, obscurity)` produces a composite score plus a
set of hard gates.

### 3.1 Composite score (ranking)

```
S = clip01( w_o·O + w_g·G + w_n·N )
```

| Factor | Symbol | Source | Weight |
|--------|--------|--------|--------|
| Obscurity | O | supplied `ObscurityAssessment.score` (domain `scoreObscurity`) | 0.35 |
| Geographic specificity | G | domain `geographicSpecificityRaw(candidate)` | 0.25 |
| Narrative potential | N | `narrativePotentialRaw(candidate)` | 0.40 |

Narrative potential is weighted highest because a story needs *material*. It is
the mean of three sub-signals:

- **Multiple life events** — distinct entries in `payload.lifeEvents` / `payload.events`, saturating at 3.
- **Temporal depth** — year spread across `yearStart/yearEnd`, `birth/deathYear`, and event years (saturates at `STORY_TEMPORAL_DEPTH_SATURATION_YEARS = 40`).
- **Place connection** — city/region hint or `placeLabel` (1.0), any coarse hint (0.5), else 0.

Score → band: `strong_story` (≥0.7), `candidate_story` (≥0.5), `weak_story` (≥0.3), `not_story`.

### 3.2 Hard gates (selection)

Ranking is not selection. A lead is `storyWorthy` only when **all three** gates
pass (this is the explicit `obscure + geographically specific + multiple life
events` rule):

| Gate | Condition |
|------|-----------|
| `obscure` | obscurity band is `obscure` or `highly_obscure` |
| `geographicallySpecific` | a `city` or `region` geographic hint is present |
| `multipleLifeEvents` | ≥ `STORY_MULTIPLE_EVENTS_MIN` (2) distinct life events |

The assessment carries `gates`, `score`, `band`, `storyWorthy`, a per-factor
breakdown, and a human-readable `rationale` naming which gates failed.

## 4. Selection & routing

- `selectStoryCandidates(candidates, theme, geography, options?)` — scores each
  `{ candidate, obscurity }`, keeps only `storyWorthy` survivors that also match
  the `theme` (`ThemeImpactThemeId`) and `geography`, sorts by score, and shapes
  each into a `TargetedBriefSubject`. Theme/geography matching is deliberately
  loose (payload fields, discovery signal terms, and title/summary text) and can
  be relaxed to soft signals via `requireThemeMatch` / `requireGeographyMatch`.
- `runStoryGapDiscovery(opts)` — orchestrates the full pass for a theme +
  priority geography (e.g. `redlining` × `Chicago`):

  ```
  discover/ingest → score (story-worthiness) → select → shared directive loop
  ```

  It reuses `research-directive.ts` by importing and calling
  `createTargetedBriefHandlers()` + `runResearchDirective()` (plan → gather →
  extract → decide). Candidates are supplied fixture-first (a discovery campaign
  scores obscurity upstream and hands them in via `candidates`, or lazily via
  `discover`), matching the other campaign runners. `maxBriefs` bounds how many
  briefs run; `directiveContext` injects safe-fetch deps/concurrency.

The result (`story.gap.discovery.v1`) reports considered/selected/briefed counts
and, per brief, the story-worthiness assessment and the loop's `decision` — never
a publish.

## 5. Usage sketch

```typescript
import { runStoryGapDiscovery } from '@repo/operator-cli';

const result = await runStoryGapDiscovery({
  theme: 'redlining',
  geography: 'Chicago',
  candidates,          // [{ candidate, obscurity }] from an upstream campaign
  nowIso: new Date().toISOString(),
  maxBriefs: 20,
  directiveContext: { dependencies: safeFetchDeps }, // @repo/security safe-fetch
});
// result.briefs[i].decision.action ∈ { stage_for_review | hold | reject }
```

Downstream, `stage_for_review` briefs feed the existing quarantine → judge →
story-research path (`story-research-run.ts`), where cite-bound skeletons are
assembled and validated against citation/dignity gates before any human review.

## 6. Integration

This methodology follows the "new self-contained files only" rule — **no
top-level barrels were edited.** To surface the public API through
`@repo/operator-cli`, add the following to
`packages/operator-cli/src/index.ts` (and extend the enumerated export list in
`promotion-boundary.test.ts`, which asserts the package cannot
approve/promote/publish — every symbol below is proposal/scoring only):

```typescript
export {
  STORY_WORTHINESS_METHODOLOGY_VERSION,
  STORY_WORTHINESS_METHODOLOGY_DISCLAIMER,
  STORY_WORTHINESS_WEIGHTS,
  STORY_MULTIPLE_EVENTS_MIN,
  STORY_TEMPORAL_DEPTH_SATURATION_YEARS,
  lifeEventCount,
  temporalDepthYears,
  narrativePotentialRaw,
  storyWorthinessBand,
  scoreStoryWorthiness,
  candidateMatchesTheme,
  candidateMatchesGeography,
  buildStoryBriefSubject,
  selectStoryCandidates,
  runStoryGapDiscovery,
  type StoryWorthinessFactorId,
  type StoryWorthinessFactorBreakdown,
  type StoryWorthinessGates,
  type StoryWorthinessBand,
  type StoryWorthinessAssessment,
  type StoryCandidateInput,
  type StorySelectedCandidate,
  type SelectStoryCandidatesOptions,
  type SelectStoryCandidatesResult,
  type StoryGapDiscoveryBrief,
  type RunStoryGapDiscoveryInput,
  type StoryGapDiscoveryResult,
} from './story-gap-discovery.js';
```

Add the test file to the `test` script in `packages/operator-cli/package.json`:
`src/story-gap-discovery.test.ts`.

### Migrations

**No new migration is required.** Story-Specific Discovery is a pure
in-memory scoring/routing methodology that reuses the existing research-case
quarantine pipeline and produces no durable public table (consistent with
ADR-009 — research workers cannot create release/projection tables). If a future
bead persists story-worthiness assessments to a private research lane, it must
use the reserved migration timestamp prefix **`20260724000009`** to avoid
collisions.

## 7. Deferred

- Real discovery-campaign wiring (a `discover` implementation that runs a bounded
  domain campaign + obscurity scoring for a geography, rather than fixture-fed
  candidates).
- Learned weights / threshold tuning from downstream story acceptance outcomes.
- Optional graylist parking for near-miss leads (story-worthy on 2 of 3 gates)
  for later corroboration, mirroring the discovery graylist recall lane.
