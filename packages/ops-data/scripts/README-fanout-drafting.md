# Externally drafted enrichment

The generic resumable interface is the [research worker protocol](../../../docs/research/research-operations.md).
These scripts are a BlackStory-specific import path for turning already captured entity evidence
into proposed prose. They do not search, establish identity, raise evidence maturity or publish.

1. Prepare a bounded set with `session-enrich-prepare.ts --entity-ids=<ids>`. Inputs and prompts
   must retain their entity identity and source evidence.
2. Draft through an explicitly selected model or human process. Parallel agents are optional and
   require the operator's authorization. Do not present subscription usage or unknown provider
   cost as free work. Record actual model provenance privately when available.
3. Validate answers with the shared `validateEnrichmentResponse` implementation in
   `lib/entity-enrichment-llm.ts`. Do not create another validator or alter quotations to pass it.
   Passing syntax and substring checks do not prove entailment or independent corroboration.
4. Run `session-enrich-apply.ts --answers-file=<answers.jsonl>` in its default dry-run mode.
   Each line contains `entityId` and the original `rawContent` string. Apply reviewed results
   only with both `DRY_RUN=0` and `ENRICH_ENTITIES_LLM_APPLY=1` in the intended environment.
5. If supplied, `--refusals-file=<refusals.json>` contains entity ids and explicit reasons.
   Missing or truncated evidence is a deferral, not evidence that a subject lacks significance.

The importer re-reads stored evidence and uses the same apply/validation path as
`enrich-entities-llm.ts`. Model identity belongs in private research provenance.
`SESSION_ENRICH_MODEL_ID` identifies the actual drafting model; omission records it as unspecified.
External drafting records unknown cost as null. An accepted draft still needs evidence review
and the separate publication gate.

Judge source fitness for each claim. A registry's institutional status does not make every
interpretation authoritative. Segregation, exclusion and suppression are valid historical
subjects when supported by substantive source material. Neither a missing keyword nor a failed
name match is grounds for inventing a rejection or a positive connection.
