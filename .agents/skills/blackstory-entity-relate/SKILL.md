---
name: blackstory-entity-relate
description: Judge and propose relationships between entities, expand a research network outward from a starting entity, and decide how a connection may be stated. Use when mapping relationships, proposing edges, asking whether two entities are connected, choosing juxtaposition vs. causal phrasing for a link, or planning network traversal from a case.
---

# Entity relate

Requires the BlackStory checkout. See [loading and capabilities](../../../docs/research/README.md#skills-and-harness-portability)
for tool requirements and use from any harness.

Judgment playbook for the edges of the graph: whether a relationship exists, how
strong the evidence for it is, and what language it licenses. Edge mechanics
(`propose-edge`) live in [`blackstory-entity-complete`](../blackstory-entity-complete/SKILL.md);
traversal source patterns live in
[`docs/research/network-traversal-discovery.md`](../../../docs/research/network-traversal-discovery.md)
and [`docs/research/cross-reference-stitcher.md`](../../../docs/research/cross-reference-stitcher.md).
This skill decides the judgment those tools execute.

## Decision order

1. **Type the relationship before hunting evidence.** Person-to-place (lived, worked,
   founded, buried), person-to-person (family, partnership, mentorship, litigation),
   person-to-institution (member, founder, plaintiff, employee),
   institution-to-event, place-to-event. The type dictates which record can prove it:
   a deed may establish ownership, not necessarily residence; a case file may establish
   named parties and proceedings, not the truth of every allegation; a charter may
   establish legal incorporation, not the first day an organization operated.
   An edge with no record type that could prove it is speculation, not research.
2. **Corroborate the edge itself, not just the endpoints.** Two well-sourced entities
   do not make a sourced relationship. The connection needs its own lineage under
   [`blackstory-claim-corroborate`](../blackstory-claim-corroborate/SKILL.md): a record that
   places both entities in the asserted relation. Assess source fitness and uncertainty
   rather than assigning confidence from a source count alone. A single fit primary
   record may support a narrow attributed relation; it is not independent corroboration.
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
   [`blackstory-entity-verify`](../blackstory-entity-verify/SKILL.md) before it becomes a source
   of further hops. A network built on an unverified hub is a network of errors.
6. **Record negative and ambiguous results.** "Searched the case file, no co-plaintiff
   named" is a search outcome; record collection coverage and access limits before interpreting absence. Log it so the next researcher does not re-run the dead end.
   Same-name candidates that cannot be disambiguated go to the graylist
   ([`blackstory-triage-graylist`](../blackstory-triage-graylist/SKILL.md)), never into the graph.

## Do / Never

**Do:** name the record type that could prove the edge before searching; corroborate
the relation itself; preserve source limitations in prose; verify each new node before
expanding through it; log dead ends.

**Never:** infer relationships from proximity alone; chain unverified hops; let an
LLM's plausibility judgment stand in for a record; write a causal edge without a
gated claim; merge same-name entities without disambiguating evidence.

## Working contract

**Input:** Identified endpoints, the exact relation and its time/place qualifiers.

**Output:** Proposed edges with their own passages and every intermediate node retained.

**Boundary and handoff:** Hand new identities to entity verification. Endpoint citations and proximity cannot establish a relationship.

Before acquisition, use the [shared collection-library method](../../../docs/research/research-operations.md#source-library)
for the evidence need, pin returned policy versions and explain why the collection should
contain the needed evidence. Search authorized captures, citation trails and outside sources;
the library is a starting point. Record access failures and unknown coverage. Its reviewed
status describes guidance, not the truth of a historical assertion.

**Capabilities:** Follow [capability and permission limits](../../../docs/research/README.md#capabilities-and-permissions).
Use the active harness’s available tools and report unsupported steps. Operational flags stay
in the linked operations contract; no proprietary client or model family is required.
