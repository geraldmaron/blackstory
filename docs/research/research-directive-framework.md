# Research directive framework

BlackStory research scripts share one bounded loop, regardless of whether the front door is gap-fill, a targeted county brief, relationship-chain growth, or `/stories` prose preparation:

**plan → gather → extract → decide**

Nothing in this loop publishes. Extract/decide stages propose candidates, packets, or holds for the existing quarantine → judge → auto-promote paths.

## Module map

| Layer | Location | Role |
|-------|----------|------|
| Loop contract | `packages/operator-cli/src/research-directive.ts` | `runResearchDirective`, targeted-brief handlers, sundown-town county preset |
| Gather (real fetch) | `packages/operator-cli/src/research-source-gather.ts` | DNS-pinned safe-fetch of seed URLs; snippet formatting for LLM judges |
| Story upgrade | `packages/operator-cli/src/story-research-run.ts` | `gatherStoryTopicSourceSnippets` — authority-lead URLs → real text before the brief LLM |
| Gap-fill slice | `packages/firebase/scripts/find-catalog-entity-gaps.ts` | Plan from catalog claims; downstream corsair triage unchanged |
| Sundown brief entry | `packages/firebase/scripts/discover-sundown-towns.ts` | `--state` / optional `--county` wrapper over `runSundownTownCountyBrief` |
| SSRF-safe fetch (firebase scripts) | `packages/firebase/scripts/lib/safe-fetch.ts` | Same `@repo/security` primitives as operator-cli `fetch.ts` |
| Corroboration | `packages/firebase/scripts/lib/corroborate-source.ts` | Citation-trail + Tier-1 search for multi-source confidence |

## Using the loop in a new script

1. **Plan** — describe the subject, seed URLs, and optional search queries.
2. **Gather** — default: `defaultDirectiveGather` safe-fetches `plan.seedUrls`. Override when the plan stage already loaded durable text (fixtures, GeoJSON).
3. **Extract** — domain-specific structured output (claims, candidate stubs, story brief JSON).
4. **Decide** — `stage_for_review`, `hold`, or `reject` — never publish.

```typescript
import { runResearchDirective, createTargetedBriefHandlers } from '@repo/operator-cli';

const result = await runResearchDirective(subject, {
  ...createTargetedBriefHandlers(),
  extract: ({ gathered }) => ({ /* … */ }),
  decide: ({ extracted }) => ({ action: 'hold', rationale: '…' }),
});
```

## Targeted brief: sundown towns

```bash
node --conditions development --import tsx \
  packages/firebase/scripts/discover-sundown-towns.ts \
  --state Illinois --county Pekin --limit 10
```

Plan seeds from Tougaloo GeoJSON (`TOUGALOO_GEOJSON_URL`); gather fetches each town's individual page; extract emits candidate stubs with page excerpts; decide holds when no reachable sources.

Add `--apply` to write under `packages/firebase/fixtures/sundown-towns-research/runs/`.

## Story research real-source fetch

`story-research-run` now gathers `authorityLeadHints` through safe-fetch for non-mock providers (override with `gatherRealSources: false`). Preloaded `sourceSnippets` remain as fallback when fetch fails.

```bash
operator-cli story-research-run --topics topics.json --provider openrouter
```

## Deferred

- Prioritized triage for the 1589 gap-fill candidate stubs (volume gate before bulk gather).
- Moving `corroborate-source.ts` into operator-cli (firebase scripts still import the lib copy).
- Full relationship-chain directive preset (repo-fh8u backfill orchestration).
