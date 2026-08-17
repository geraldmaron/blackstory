---
name: blackstory-claim-corroborate
description: Weighs citations, independent lineage, and superlatives so a claim can ship honestly. Use when corroborating a source, asking if a citation is enough, checking a "first African American" claim, walking a source ladder, or setting confidenceLevel.
---

# Claim corroborate

Judgment playbook. Do not load `docs/research-workflow` recency discipline here. A 1963
finding aid is not stale.

Canonical rules:

- [`docs/research/citation-standard.md`](../../../../docs/research/citation-standard.md)
- [`docs/research/confidence-lineage.md`](../../../../docs/research/confidence-lineage.md)
- Code: `packages/ops-data/scripts/lib/corroborate-source.ts`, `confidence.ts`,
  `tier1-sources.ts`

## The Wikipedia rule

Wikipedia is a reputable secondary source. It may *carry* a claim. It may never
*corroborate* one, and it may never be the sole basis for a superlative.

`classifySourceForConfidence` maps Wikipedia to `reputable_secondary`.
`isWikipediaHost` excludes it from every corroboration path. Wikipedia is a bridge to
Tier-1 references, never returned as evidence itself.

| Situation | What to do |
|---|---|
| Wikipedia is the only source | Write the claim, `confidenceLevel: 'low'`, one lineage. Keep it out of the summary. |
| Wikipedia plus an independent institutional source | Cite the institution. Summary is fine. |
| A "first" / "only" / "largest" | Institutional source or the assertion does not ship. |
| Sources disagree on scope or date | Prefer the reading two independent lineages share. Record dissent. Do not average it into prose. |

`confidenceLevel: 'low'` exists on the public claim contract and must be used when evidence
is thin. Do not silently upgrade to `high`.

## Source ladder (same subject, different lineage)

`corroborate-source.ts` already tries, in order:

1. Citation-trail on the primary page (outbound links to Tier-1 hosts, reject same-lineage)
2. Wikipedia bridge to that trail (Wikipedia itself never returned)
3. SearXNG restricted to Tier-1 (`.gov` / `.mil` / `si.edu`, plus NPS / LoC / archives)
4. Curated reputable-secondary hosts (for example BlackPast, HMDB)
5. Same secondary hosts via search, different hostname only

Every fetch goes through the SSRF-safe path. Best-effort: an empty step is "no corroboration
found", not an error to paper over.

Tier-1 hosts live in `packages/ops-data/scripts/lib/tier1-sources.ts`. Do not invent a second
list.

Independent lineage is counted by `lineageRootId`. Five syndicated copies with one root are
one lineage, not five.

## Superlatives

"First African American to…" is the highest-risk sentence type in this catalog. It needs the
institution that would know: the school, the association, the state, the archive holding the
record. Wikipedia-only superlatives have already shipped false claims (William F. Penn / Yale
Medicine). That class of claim stays unpublished until the institution agrees.

## Case vs claim

Filling a research-case checklist gap is [`blackstory-case-drafting`](../case-drafting/SKILL.md)
(`attach-evidence`). This skill decides whether the evidence *weighs enough* to support the
words on the page.

## Do / Never

**Do:** fetch the cited URL before treating it as a receipt; name the lineage count; keep
contradictions visible; use `low` when only one lineage exists.

**Never:** treat LLM confidence as publication authority; count Wikipedia as the second
source; fetch URLs with bare `fetch()` (use the operator-cli / safe-fetch path); paste
unresolved cites into public summaries.

## Eval

Geographic ambiguity, citation entailment, and entity-resolution cases already live in
[`docs/research/gold-corpus.md`](../../../../docs/research/gold-corpus.md). Score new
corroboration judgments against those fixtures rather than hoping the prompt is right.
