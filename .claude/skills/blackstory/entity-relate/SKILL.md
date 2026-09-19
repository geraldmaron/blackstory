---
name: blackstory-entity-relate
description: Judge and propose relationships between entities, expand a research network outward from a starting entity, and decide how a connection may be stated. Use when mapping relationships, proposing edges, asking whether two entities are connected, choosing juxtaposition vs. causal phrasing for a link, or planning network traversal from a case.
---

# Entity relate

Judgment playbook for the edges of the graph: whether a relationship exists, how
strong the evidence for it is, and what language it licenses. Edge mechanics
(`propose-edge`) live in [`blackstory-entity-complete`](../entity-complete/SKILL.md);
traversal source patterns live in
[`docs/research/network-traversal-discovery.md`](../../../../docs/research/network-traversal-discovery.md)
and [`docs/research/cross-reference-stitcher.md`](../../../../docs/research/cross-reference-stitcher.md).
This skill decides the judgment those tools execute.

## Decision order

1. **Type the relationship before hunting evidence.** Person-to-place (lived, worked,
   founded, buried), person-to-person (family, partnership, mentorship, litigation),
   person-to-institution (member, founder, plaintiff, employee),
   institution-to-event, place-to-event. The type dictates which record can prove it:
   a deed proves residence, a case file proves litigation, a charter proves founding.
   An edge with no record type that could prove it is speculation, not research.
2. **Corroborate the edge itself, not just the endpoints.** Two well-sourced entities
   do not make a sourced relationship. The connection needs its own lineage under
   [`blackstory-claim-corroborate`](../claim-corroborate/SKILL.md): a record that
   places both entities in the asserted relation. One lineage means
   `confidenceLevel: 'low'` and the edge stays out of narrative prose.
3. **Set the edge's language tier.** Same rule as all prose
   (`docs/content/neo-voice.md` Part V): juxtaposition by default ("both appear in,"
   "in the same year," "three blocks from"); relational verbs ("partnered,"
   "sued," "founded") only when a record states the relation; causal verbs only
   behind a gated causal claim. Never upgrade an address match into an
   acquaintanceship, or co-membership into collaboration.
4. **Preserve the path.** A → B → C is two edges, not an A → C assertion. Keep each
   predicate, direction, identity ambiguity, time qualifier and evidence selector. Two different
   relations to the same node must survive deduplication. Do not multiply model scores into a
   chain probability. Retain an unmapped source predicate instead of forcing it into a misleading
   category. Source dates and the seed's lifespan do not become facts about the neighbor.
5. **Expand deliberately, not greedily.** From a verified entity, the productive next
   hops are: co-signers and witnesses on its documents; co-plaintiffs and opposing
   parties in its cases; the institutions its records name; the named neighbors on
   its census page and city-block records. One hop at a time, each candidate through
   [`blackstory-entity-verify`](../entity-verify/SKILL.md) before it becomes a source
   of further hops. A network built on an unverified hub is a network of errors.
6. **Record negative and ambiguous results.** "Searched the case file, no co-plaintiff
   named" is a search outcome; record collection coverage and access limits before interpreting absence. Log it so the next researcher does not re-run the dead end.
   Same-name candidates that cannot be disambiguated go to the graylist
   ([`blackstory-triage-graylist`](../triage-graylist/SKILL.md)), never into the graph.

## Do / Never

**Do:** name the record type that could prove the edge before searching; corroborate
the relation itself; keep one-lineage edges out of prose; verify each new node before
expanding through it; log dead ends.

**Never:** infer relationships from proximity alone; chain unverified hops; let an
LLM's plausibility judgment stand in for a record; write a causal edge without a
gated claim; merge same-name entities without disambiguating evidence.
