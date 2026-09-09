# Confidence and source lineage

`packages/domain/src/confidence-engine/` extends the `packages/domain-core/src/claims/confidence.ts` claim-confidence formula with an auditable orchestration layer. It does not replace the claim helper or alter its weights.

Every module named below lives in `@repo/domain-core` and is re-exported by `@repo/domain`, so `packages/domain/src/claims/*.ts` are shims (the split exists to break a `@repo/domain` ↔ `@repo/security` cycle). Import from `@repo/domain` as callers already do; read the implementation in `domain-core`.

## Deterministic score

The engine scores source authority, evidence directness, lineage independence, temporal proximity, geographic precision, entity-match quality, and extraction quality. Credible contradictory lineages subtract a bounded penalty. Publication thresholds come from the versioned product constitution.

Callers must supply `calculatedAt` when they need byte-stable records. The score itself is deterministic regardless of evidence input order.

## Independent lineage

Evidence is grouped by `lineageRootId` when the constitution enables `blockSyndicatedCopiesAsIndependent`. The highest-quality item represents each lineage. Therefore five syndicated or republished copies with one root contribute one independent lineage, not five.

### A lineage is a work, not a domain

`lineageRootId` names the underlying work. It used to be `new URL(url).hostname`, which got the answer wrong in both directions: five newspapers carrying one wire story looked like five independent lineages, and a patent read on uspto.gov and again on patents.google.com looked like two. `resolveSourceLineage` in `packages/domain-core/src/claims/lineage.ts` is the resolver, and it returns `{ key, kind, basis, bridge, inferred }` with `kind` one of `work`, `bridge`, or `authority`.

Resolution order, most specific first:

1. **Recorded provenance.** An `upstreamWorkId` set by the pipeline always wins. It is the only way to know three unrelated hosts are carrying one wire story, because nothing in the three URLs says so.
2. **A work identifier read out of the URL.** US patent numbers (normalized across `US252386`, `US-252,386-A`, `0252386`, with the `D`/`RE`/`PP` series prefixes kept), DOIs, Library of Congress item ids, Chronicling America issue pages, National Archives catalog ids, Internet Archive items. This is what collapses mirrors across hosts.
3. **Bridges.** Wikipedia, Wikidata, Wikimedia and Wikisource hosts all collapse onto the single key `bridge:wikimedia` and come back with `bridge: true`, so ten spellings of one article are one lineage and no lineage at all for corroboration purposes.
4. **The issuing authority behind the host.** Named families where the registrable domain gets it wrong (uspto.gov and patentsview.org are both the Patent Office; si.edu and smithsonianmag.com are both the Smithsonian; archives.gov and docsteach.org are both the National Archives), otherwise the registrable domain.

Two rules keep this honest. Every inference either lowers the lineage count or leaves it unchanged, never raises it: two documents from one authority group into one lineage rather than being treated as independent corroboration, because two reports by the same agency are usually one agency's account. The only way to split inside an authority is `independentCreation` with a stable document id, which a caller passes when provenance has actually been checked. And anything resolved at step 3 or 4 carries `inferred: true`, which is the flag the `host_based_lineage_suspect` deficit reads. Host stays useful metadata. It stops being the answer.

### A bridge carries a claim and never corroborates one

Wikipedia and Wikidata may carry a claim (see [citation-standard.md](citation-standard.md)). They contribute no independent lineage, and since the bridge rule landed they also do not dilute real evidence. Both halves matter, and `packages/domain-core/src/claims/confidence.ts` implements them:

- Bridges never count toward `independentLineageCount`. A Wikipedia article plus a government record is one corroborating lineage, not two, so a bridge can never be the thing that lifts a claim over the publish threshold.
- When real evidence is present, bridges drop out of the quality aggregates entirely. Averaging a bridge's authority into a government record's used to make a claim score *lower* for having cited an extra source, which is how "more research made the record less publishable" happened.
- When a bridge is all there is, it stays in the aggregates. A bridge-carried claim is worth more than no claim, and scoring it zero would misrepresent it as unevidenced rather than as thinly evidenced.

The numbers, from `packages/ops-data/scripts/lib/confidence.test.ts`: a Wikipedia-only claim scores **0.66** with `independentLineageCount: 0`, where a lone reputable-secondary host (historicsites.dcpreservation.org) scores **0.72** with one lineage. Both sit under the 0.75 `standardPublish` threshold, and neither publishes alone. Those two used to be the same number, which was the tell: a bridge and a heritage-inventory record are not equally good evidence, and the old rule could not say so because it counted a hostname as a lineage. Adding a bridge alongside a real source now leaves the score exactly where it was.

## Evidence fitness is claim-relative

Authority used to be a property of the host alone: a `.gov` URL scored 0.95 for every claim ever attached to it. `assessSourceFitness(sourceClass, assertionClass)` in `packages/domain-core/src/claims/source-fitness.ts` replaces that with a statement about what a document can be *asked*. It takes one of 24 source classes and one of 15 assertion classes and returns `{ fitness, rationale, limitations }`.

Fitness levels, and the authority component each contributes through `sourceAuthorityForFitness`:

| Fitness | Authority | Meaning |
|---|---|---|
| `authoritative` | 1 | The document decides the question. |
| `strong` | 0.85 | Good evidence; corroboration strengthens rather than rescues it. |
| `conditional` | 0.55 | Usable, with its known failure modes weighed. |
| `leadOnly` | 0.2 | Tells you where to look. Never acceptance on its own. |
| `unfit` | 0 | Cannot answer this question at all, however many copies exist. |

`unfit` is a floor of zero rather than a small number on purpose, so ten unfit sources cannot accumulate into a supported claim. The resolver also throws on an unrecognised source or assertion class instead of defaulting: under the old lookup a misspelled class silently scored 0.2, which turned a typo into a quiet downgrade rather than a failure.

The patent is the case that makes the rule obvious. A patent specification is `authoritative` for a record fact ("US 252,386 was granted in 1882") and for technical scope, `strong` for technical identity and chronology, `conditional` for invention attribution, `leadOnly` for place (the address on the face of a patent is where the filer was, not where the work happened), and `unfit` for community identity, for a superlative, and for commercial or societal impact. The Patent Office did not record inventor race, which is exactly why Henry E. Baker had to identify Black inventors through correspondence and professional networks. Same document, same host, one authority score under the old rule; a different answer per question under this one.

`HIGH_IMPACT_ASSERTION_CLASSES` names the assertions that need more than one independent lineage before they ship as settled: `invention_attribution`, `superlative`, `societal_impact`, `commercial_impact`, `community_identity`. Two lineages is necessary and not sufficient there: one of them has to be `authoritative` or `strong` *for that assertion class*, not merely independent.

A companion module, `packages/domain-core/src/claims/attribution.ts`, works on the sentence rather than the source: it separates broad attribution verbs that claim a whole category ("invented", "pioneered", "father of") from bounded ones that state what a receipt actually records ("patented", "improved", "co-invented"), and flags superlative, impact and commercial language whose evidence does not reach that far. It reports; it never rewrites. A finding there is a research task or a correction, not a licence to auto-edit published prose.

## Research maturity is a different measurement

Confidence answers "how strong is the evidence for this claim". Completeness answers "how many rendered fields are populated" (see [entity-completeness-audit.md](entity-completeness-audit.md)). Neither answers "was the research actually done". `assessResearchMaturity` in `packages/domain-core/src/research/maturity.ts` does, over six states:

`seeded` → `grounded` → `corroborated` → `contextualized` → `deep_research` → `reference`

Maturity is **derived, always**. There is deliberately no setter: an operator who could mark a record `reference` would eventually do so under deadline, and the state would come to mean "someone said so". A record earns the highest state whose gates, and every lower state's gates, are clear; a single blocker at `grounded` caps it at `seeded` however much evidence sits above, because depth built on an unsupported summary is depth on sand. There are 17 gates (`RESEARCH_GATE_IDS`), each blocker carries an explanation and a remediation, and the assessment records `evaluatorVersion` so a stored maturity from an older evaluator reads as what was believed then rather than as a current finding.

`reference` does not mean finished. A later source can reopen any record, and the model has no state above `reference` precisely so nothing reads as permanent.

The gates are fed by `packages/domain-core/src/research/deficits.ts`, a taxonomy of 29 named deficits (`wikipedia_only_summary_claim`, `single_lineage_high_impact_claim`, `claim_source_unfit_for_claim`, `host_based_lineage_suspect`, `source_type_monoculture`, `patent_used_as_racial_identity_evidence`, and the rest). Everything in it is deterministic and model-free: noticing that a high-impact claim rests on one lineage, or that a superlative has no source fit to establish an ordering, is counting and table lookup. Models are for claim extraction, contradiction reconciliation and historical synthesis, not for noticing. The rule the taxonomy is built around: **adding a source must not clear a deficit by itself.** Every detector counts lineages, fitness and selectors, never URLs.

`describeMaturity` returns a sentence, not a number ("CORROBORATED — 2 blocker(s) to contextualized"), for the same reason: a score cannot be acted on, and a named blocker is a research task.

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

The dataset is private calibration material and is not a public projection.
