# Research framework

Start here when conducting research, adapting the framework to another subject, or improving the
engine. Read [operations](./research-operations.md) only for the commands needed. The
[architecture challenge procedure](../architecture.md#challenge-procedure) applies to every rule
here. Work status lives in Beads, not in duplicate checklists or another PRD.

## Purpose and status

The engine should find evidence, resolve identities, expose missing knowledge, and assemble
traceable relationships. Black history is its primary domain profile. Thoroughness means that
important questions, alternative explanations, source gaps, and contradictions were examined
within explicit bounds. It does not mean searching forever or producing more fluent prose.

| Capability | Current implementation | Limit |
|---|---|---|
| Portable contracts | `@repo/research-kernel`: JSON Schema, generated TypeScript/Python, profiles | Shared TS/Python malformed-input fixtures enforce the same JSON Schema boundary |
| Source acquisition | CLI search routing, safe-fetch, adapter inputs, source capture | Provider availability and storage permission must be configured explicitly |
| Generic harness input | `harness-run --subjects`, `--url`, explicit file-backed adapters | Extracts proposals; durable execution uses `research-run` and `research-work` |
| Claim/edge extraction | Strict schemas, exact quote and cited-record attachment | Attachment is not entailment; model confidence is uncalibrated; review remains required |
| Graph discovery | `expand`, catalog traversal, cross-reference/shared-source/adjacency candidate generators | Wikidata statement ranks, qualifiers and references survive staging; cross-source resolution and graph evaluation need work |
| Research planning | `enrich-entity`, maturity deficits, kernel needs/frontier policy | Plans and executes bounded acquisition; reviewed evidence alone can raise maturity |
| Preservation | `capture-backfill`, safe fetch, Supabase capture sink, Wayback lookup and resumable SPN2 jobs, explicit retention/disposal | Local metadata is not a full archived page; coverage and public pointer delivery need separate measurement |
| Evidence retrieval | Private capture passages, full text + pgvector/RRF, exact selectors, model/text revision checks | 768 dimensions; real semantic recall and archive coverage remain unmeasured |
| Headless use | Immutable run manifests, scoped leases, dependencies, attempt reservations, accounting and proposal artifacts | Built-in acquisition/model execution and external lease handoff; automatic model admission requires independent evaluation |
| Scheduling | Job registry, worker entry points, manual Actions dispatch | No research schedule should be active; no Corsair dependency |

The [audit evidence](./framework-audit.md) records observations and source research. Do not infer
production readiness from a schema, test fixture, function name, or an old statement of completion.

## One research loop

1. Define the question, domain profile, scope, sensitivity, and the decision the answer informs.
   Separate the subject's historical dates from document dates and retrieval dates.
2. Inspect existing entities, sources, captures, claims, and unresolved needs. Reuse evidence
   before paying to rediscover it. Establish alternatives, not only the preferred hypothesis.
3. Build explicit evidence needs and bounded tasks. Every consequential assertion needs a
   disconfirming search or a recorded reason the search could not be completed.
4. Retrieve leads by identifiers, exact/variant names, full text, citations, graph neighbors,
   geography/time where appropriate, and semantic similarity. Fetch the underlying work.
5. Preserve source identity and allowed content. Attach an exact selector, retrieval outcome,
   content hash, holding institution, and lineage. Record missing pages, partial OCR, and access
   restrictions as uncertainty rather than replacing them with model knowledge.
6. Extract atomic assertions and relationship hypotheses. Separate observation, attributed
   interpretation, identity resolution, causal explanation, and open question.
7. Reconcile independent evidence and competing explanations. Check whether the passage entails
   the exact assertion and whether its scope, dates, participants, and language match.
8. Review identity and each edge independently. Stage proposals with unresolved blockers.
   Draft prose from accepted evidence only. Publication remains a separate authorized operation.
9. Stop on fulfilled needs and measured diminishing information gain, or report a budget/access
   stop with unfinished needs. A cap is not a finding of completeness. Persist the handoff.

The same loop applies to a CLI process, model tool caller, or human-assisted investigation. A
model's conversational memory is never the durable state. Built-in and external workers share this loop through the execution ledger, preserving plans, attempts, artifacts and unresolved needs.

## Finding overlooked records

Select retrieval patterns according to the missing evidence, rather than sending every question
through the same search prompt:

- **Identity and aliases:** dated names, married names, initials, spelling/OCR variants, transliteration,
  role-qualified names, institutional succession, and identifiers. Preserve original spelling.
- **Document neighborhoods:** witnesses, co-signers, co-plaintiffs, neighbors, employees, board members,
  publishers, correspondents, patrons and custodians. Read finding aids and collection hierarchy,
  not only item titles. An unindexed box is a lead with an access need.
- **Backward and forward citation chasing:** follow the underlying work, then later corrections,
  disputes and reuse. Host count is not independent lineage count.
- **Time/place reconstruction:** directories, deeds, maps, probate, census pages, organizational
  records and contemporary press. Use explicit intervals and precision. Broad era overlap is
  only a cheap candidate filter and excludes no undated record from other methods.
- **Community and oral evidence:** use community archives, oral histories and local memory with
  consent, context, attribution, and claim-relative fitness. Institutional omission is not a veto.
- **Negative-case sampling:** deliberately inspect low-ranked, non-digitized, non-English, poorly
  OCRed and institutionally underrepresented records. Catalog density measures our coverage.

Record what was searched, archive/collection coverage, filters, terms, time span, access limits,
and why the source would be expected to contain the fact. Without those conditions, “not found”
is a search outcome, not evidence of historical absence. Do not fill archival silences with
plausible invented people or connections.

## Relationships and chains

An edge carries subject, predicate, object, direction, temporal/role qualifiers, evidence selector,
lineage, assessment status, and the task that found it. Discovery also considers explicit cross-references and shared citations when dates or locations
are missing; those signals establish neither identity nor an edge. Different predicates between the same
entities are different edges. Different discovery paths remain traceable. A source record about
both endpoints is insufficient unless it supports the relation.

A path A → B → C does not establish A → C. Preserve B, both edge types and evidence, and any
identity ambiguity. Shared dates, addresses, topics or vector neighbors are candidate signals.
Do not force “educated at” into “member of” or a holding institution into a person's location;
retain the source predicate until the domain vocabulary can represent it faithfully.

Bound hops, requests, branching, time, and model spend. Cache by source/identifier and content
revision. Avoid cycles and repeated calls without discarding distinct predicates. High-degree
hubs can exhaust a budget while hiding obscure nodes; evaluate sampling and frontier priority
on a held-out corpus before making a traversal default.

Public graph projection must use a cited claim naming the exact predicate and target; unrelated
entity claims and seed fallback edges cannot supply proof. Canonical release graphs require explicit
accepted/published status and relationship-specific evidence. Legacy stored shortcuts must be
reconciled during cutover; smaller graph coverage is preferable to an unsupported edge.

## Uncertainty and probability

Keep relevance, source fitness, entailment, identity-match uncertainty, lineage independence,
contradiction severity, geographic/temporal precision, and claim confidence separate. A model's
0.9 is not a 90% probability. A weighted score is not a calibrated posterior. An information-value
score is a scheduling heuristic until calibrated against observed yield.

Bayesian comparisons can be useful when priors, likelihoods, alternatives and dependence
assumptions are defensible. Do not multiply dependent source probabilities or edge confidences
into a chain probability. Syndication, copied biographies, shared archival roots, selection bias,
survivorship, digitization bias and OCR error make independence especially unsafe here.

Evaluate with labeled claims and identity/edge decisions that were not used to tune prompts.
Stratify by domain, source kind, obscurity, era, language and risk. Measure entailment precision,
false merges, missed entities, edge/path recall, contradiction discovery, calibrated error where
probabilities are claimed, and cost per accepted evidence need. Confidence intervals and sample
size qualify all performance claims. Publish thresholds are targets until supported by a corpus.

## Portability and cost

Reuse the kernel, source clients, evidence ledger and model-provider port. Domain profiles own
vocabulary, source-fitness rules, query strategies, sensitivity, budgets, and review criteria.
Black history rules do not become universal facts about other domains. The harness accepts
source records with arbitrary connector labels; no geography or Black history subject is
required. A second-domain run must test portability before a package is called reusable.

Prefer deterministic parsing, stable identifiers, deduplication, cached capture reuse, and cheap
blocking before model calls. Pay for extraction or difficult synthesis only when a named need
requires it. Reserve stronger review for consequential ambiguity. Charge retries, failed calls,
OCR, retrieval, embeddings and preservation polling to the case budget. Do not make “free” model
availability or a personal server a reliability assumption. Select providers through measured
quality and current prices, not a permanently frozen roster.

## Preservation and source access

Keep the original source link as well as any archival pointer. Preserve the document's citation
and holding institution even when no web capture is possible. A successful Internet Archive
availability lookup is a historical snapshot pointer, not a fresh save or verification of the
current page. SPN submission is a request; only successful completion supplies a saved pointer.

Use `capture-backfill` in bounded batches. Its dry run inventories; `--commit` retrieves and
persists; `--wayback` additionally requests preservation where an exact source decision permits it. Review rights and
sensitivity before sending a URL to an external archive. Never submit private/signed URLs,
credentials, or unpublished sensitive material. Respect retention and source policies. Run the explicit `capture-retention` sweep to erase
expired or withdrawn source text and passages; retry queued storage disposal until acknowledged.
This sweep covers captures and their retrieval index, not every derived research artifact or an
external archive takedown. Sensitive downstream artifacts need a separately reviewed retention plan. Hash-only
or excerpt-only rows do not prove full-page recoverability, and archiving does not establish truth.

## Skills and comments

Judgment playbooks under `.claude/skills/blackstory/` specialize this method. CLI pointer skills
link to operations rather than duplicating flags. Any model can begin with this document and the
CLI; no particular chat product is required. Skills describe the decision to make and its evidence
requirements. They must not silently publish, invent sources, infer approval requirements beyond
the user's authorization, or turn one failure/example into a universal rule.
