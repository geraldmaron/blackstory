# Confidence and source lineage

 extends the  claim-confidence formula with an auditable orchestration layer. It does not replace the claim helper or alter its weights.

## Deterministic score

The engine scores source authority, evidence directness, lineage independence, temporal proximity, geographic precision, entity-match quality, and extraction quality. Credible contradictory lineages subtract a bounded penalty. Publication thresholds come from the versioned product constitution.

Callers must supply `calculatedAt` when they need byte-stable records. The score itself is deterministic regardless of evidence input order.

## Independent lineage

Evidence is grouped by `lineageRootId` when the constitution enables `blockSyndicatedCopiesAsIndependent`. The highest-quality item represents each lineage. Therefore five syndicated or republished copies with one root contribute one independent lineage, not five.

## Recalculation and audit

`recalculateConfidence` and its Python mirror always recompute from current inputs. Each result records:

- engine, audit, and per-component versions;
- fixed component weights and the constitution policy version;
- SHA-256 fingerprints for source, evidence, contradiction, and policy inputs;
- which fingerprint classes changed from the prior audited result.

Persist the complete result beside the claim version. A source reclassification, evidence-quality edit, contradiction change, or policy change then produces a traceable new assessment.

## Public language

`evaluatePublicLanguage` applies the constitution phrase gate and caps the requested procedural status at the status supported by evidence. Weaker criminal-process language is permitted; stronger or incompatible status language is denied with `procedural_status_exceeds_evidence`. The returned effective status remains the evidence status.

## Calibration export

`exportConfidenceCalibrationDataset` emits stable claim ordering and preserves score inputs, components, versions, thresholds, lineage counts, and optional reviewed outcomes. The contract is:

`packages/schemas/confidence-engine/confidence-calibration-dataset.v1.schema.json`

The dataset is private calibration material for  and is not a public projection.
