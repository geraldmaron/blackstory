# Gold corpus and calibration harness

This harness provides a private, versioned evaluation corpus for relevance, publication safety,
confidence calibration, citation entailment, and entity resolution. It is local-only under
the [engineering contract](../decisions-carryover.md): evaluation uses fixtures and neither CLI applies cloud changes.

## Corpus

`packages/testing/src/gold-corpus/fixtures/gold-corpus.v1.json` contains 125 synthetic examples (corpus version 1.1.0, counted 2026-10-07).
Its metadata describes a synthetic consensus-adjudication protocol; that description alone
does not establish that independent historical experts reviewed the examples. There are at least ten examples in each required category:
included and excluded schools, relevant and irrelevant people, disputed and high-impact
claims, sparse records, living people, private residences, sundown-town candidates,
geographic ambiguity, and source lineage.

Synthetic records prevent the calibration fixture from publishing personal information or
turning preliminary allegations into factual claims. Every example records a rationale,
publication label, relevance label, claim status, confidence outcome, citation-entailment
label, entity-resolution result, completeness, privacy context, geographic ambiguity, and
lineage roots.

The corpus uses semantic `corpusVersion` values. Any adjudication or example change requires
a version bump and a new evaluation. Contracts are in `packages/schemas/gold-corpus/`.

## Metrics

The harness measures:

- relevance precision and recall, with `include` as the positive class;
- false-publication rate, defined as prohibited examples among predicted publications;
- Brier score and ten-bin expected calibration error;
- citation-entailment accuracy;
- exact entity-resolution accuracy, including the expected entity ID for matches.

Prediction sets must identify the exact corpus version and contain exactly one prediction
for every example. Missing, duplicate, unknown, out-of-range, or cross-version inputs fail
closed.

Default gates require precision ≥ 0.90, recall ≥ 0.85, false-publication rate ≤ 0.05, Brier
score ≤ 0.15, expected calibration error ≤ 0.10, citation-entailment accuracy ≥ 0.90, and
entity-resolution accuracy ≥ 0.90.

## Dry-run commands

Both commands print JSON to standard output by default. Supplying `--out` creates a new file
and refuses to overwrite an existing evaluation artifact.

```bash
node scripts/gold-corpus/eval.mjs \
  --corpus packages/testing/src/gold-corpus/fixtures/gold-corpus.v1.json \
  --predictions packages/testing/src/gold-corpus/fixtures/predictions.after.v1.json \
  --evaluated-at 2026-07-17T01:00:00.000Z

node scripts/gold-corpus/before-after.mjs \
  --corpus packages/testing/src/gold-corpus/fixtures/gold-corpus.v1.json \
  --before packages/testing/src/gold-corpus/fixtures/predictions.before.v1.json \
  --after packages/testing/src/gold-corpus/fixtures/predictions.after.v1.json \
  --evaluated-at 2026-07-17T01:00:00.000Z
```

Before/after reports require both prediction sets to use the same corpus and expose signed
deltas for every metric plus regression names.

## Automatic-publication gate

Any automatic-publication feature must call `assertCorpusEvaluationPassed` before it can be
enabled. The gate requires a passing evaluation whose corpus and algorithm versions exactly
match the feature configuration. Missing, stale, mismatched, or failed evidence blocks the
feature. Manual review paths can remain enabled with automatic publication disabled.

## What each evaluation can establish

The synthetic policy corpus above contains context and expected labels, not source passages
and historical claim text from which a blind reader could infer entailment. Its supplied
prediction files exercise metric/gate mechanics. Passing them is not evidence that a model
can fact-check a live entity, calibrate its confidence or produce good prose.

The separate [held-out retrieval pilot](../../packages/testing/src/gold-corpus/fixtures/heldout-evidence-retrieval.v1.md)
contains public-source passages, claims, identity/edge tasks and separately frozen predictions.
Use its existing corpus/prediction/gold schemas for new blind evidence experiments. Preserve
its stated sample-size, source-selection, provisional-label and portability limits; a small
retrieval pilot does not certify all historical domains or publication prose.

The [skill review cases](skill-review-cases.md) are transparent development examples based on
observed failures and controls. They test whether an operator applies the method to concrete
inputs; they are not held out, and self-review is not independent model evaluation.

For a release-quality study, freeze the exact skill/model versions and blind inputs before
label inspection; have qualified independent reviewers adjudicate disputed cases; keep work
lineages split across development and held-out sets. Include official-source errors, minority
accounts, namesakes, sparse records, qualifier loss and altered prose after claim acceptance.
Report false acceptance and false rejection separately, with sample sizes, disagreements,
uncertainty and cost. Do not turn one overall score into permission to publish a contradicted
claim. Provider calls, budgets and publication authority remain explicit.
