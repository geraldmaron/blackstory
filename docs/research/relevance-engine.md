# Deterministic relevance engine

Contract-layer API for scoring discovery candidates through deterministic relevance gates, producing include / exclude / supporting-context decisions with human-readable explanations. Relevance consumes  discovery candidates and  query-pack signal classification.

## Scope

| Component | Role |
|-----------|------|
| `dimensions` | Weighted feature values: signal strength, thematic alignment, geographic connection, source authority, distinctiveness |
| `gates` | Sequential checks: signal present, weak-signal independence, negative-only, duplication, include evidence |
| `decisions` | Map composite score + gates to constitution thresholds |
| `why` | Human-readable “Why this appears” without numeric scores |
| `override` | Manual override with required reason (min 12 chars) |
| `public` | Public projection strips composite score and feature values |

## Decisions

- **include** — composite score ≥ `includeMinimum` (0.7), promotable signal, corroborated evidence
- **supporting_context** — score ≥ `supportingContextMinimum` (0.4) but below include bar or weak-only
- **exclude** — no signal, negative-only, duplicate, or below exclusion threshold

## Weak-signal rule

Weak discovery signals are capped at `weakSignalIndependentCeiling` (0.5) and cannot independently reach include. Geographic-only or period-only matches remain supporting context.

## Privacy

Composite scores and feature values are **private research metadata**. Use `toPublicRelevanceExplanation()` for user-facing copy — it exposes only `whyThisAppears` and `decision`.

## Artifacts

- TypeScript: `packages/domain/src/relevance/`
- Python mirror: `workers/research/src/black_book_research/relevance/`
- Gold fixtures: `packages/domain/src/relevance/fixtures/relevance-gold-fixture.v1.json`
- JSON Schema: `packages/schemas/relevance/relevance-assessment.v1.schema.json`

## Tests

```bash
cd packages/domain && pnpm test
cd workers/research && uv run pytest src/black_book_research/relevance/test_relevance.py
```

## Follow-ups

- Firestore persistence for relevance assessments
- Gold corpus calibration harness
- Public “Why this appears” storytelling layer
