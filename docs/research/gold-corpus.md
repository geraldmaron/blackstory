# Gold corpus and calibration harness

BB-047 provides a private, versioned evaluation corpus for relevance, publication safety,
confidence calibration, citation entailment, and entity resolution. It is local-only under
ADR-011: evaluation does not read or write Firestore and neither CLI applies cloud changes.

## Corpus

`packages/testing/src/gold-corpus/fixtures/gold-corpus.v1.json` contains 120 synthetic,
consensus-adjudicated examples. There are at least ten examples in each required category:
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

The package root should export `./gold-corpus/index.js` from
`packages/testing/src/index.ts`; that shared barrel is intentionally merged by the parent
task owner.
