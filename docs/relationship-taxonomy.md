# Relationship Taxonomy & Authoring Contract

**Audience:** candidate generators and operators authoring released entity projections and
relationship proposals. The current checked-in seed examples are in
`packages/ops-data/fixtures/records.ts`; active releases are assembled from reviewed projections,
not from an obsolete catalog fixture path.

**Status:** normative. Field names, enum values, and semantics below are quoted verbatim from the
source files cited in each section. If code and this document ever disagree, the code wins — file
an issue and fix this doc.

**Authoritative sources** (read these, not a paraphrase, when in doubt):

- `packages/schemas/src/relationship-vocabulary.ts` — `RELATIONSHIP_TYPES` (the vocabulary itself), `LEGACY_DB_RELATIONSHIP_TYPES`, `DB_RELATIONSHIP_TYPES`, and `relationshipTypeSchema` (the read-side gate). Every other module re-exports these; nothing restates them.
- `packages/domain-core/src/relationship.ts` — `RelationshipType`, `RelationshipRole`,
  `EntityRelationship`, direction/temporal semantics (`RELATIONSHIP_TYPE_SEMANTICS`), evidence/
  role/temporal guardrails, and the causal-edge guardrail. `packages/domain/src/relationship.ts`
  is a re-export shim.
- `packages/domain/src/entity-kinds.ts` — `EntityKind` vocabulary.
- `packages/domain/src/graph/catalog-related.ts` — `CatalogRelatedEntry` (the authoring shape),
  directed-key deduplication, exact claim matching, mention resolution, and skip behavior.

---

## 1. The Authoring Contract

### 1.1 What you actually write

Catalog fixture authors and candidate generators do **not** write `EntityRelationship` records
directly. You write a `related[]` array on each entity, using the `CatalogRelatedEntry` shape from
`packages/domain/src/graph/catalog-related.ts`:

```ts
export type CatalogRelatedEntry = {
  readonly id: string;
  readonly type: RelationshipType;
  readonly direction: 'outgoing' | 'incoming';
  readonly timespan?: TemporalContext;
};
```

A pipeline step (`extractCatalogRelationships`) later converts these inline entries into canonical
`EntityRelationship` records (with `evidenceIds`, `workflowStatus: 'accepted'`,
`publicationStatus: 'published'`, `resolutionState: 'resolved'`, `createdAt`/`updatedAt`).

Field by field:

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | The **other** entity's id (the neighbor), not the current entity's own id. |
| `type` | `RelationshipType` | One of the 36 values in §1.2. Must exist in `RELATIONSHIP_TYPES` or the entry is skipped (see §1.4). |
| `direction` | `'outgoing' \| 'incoming'` | See §1.3 — which endpoint is `from` and which is `to`. |
| `timespan` | `TemporalContext` (optional) | `{ label?, validFrom?, validTo? }` — see §1.5. |

There is **no** `role`, `notes`, `geographic`, `confidence`, or workflow field on the authoring
shape — those only exist on the canonical `EntityRelationship`/`EntityRelationshipDoc` produced
downstream. Candidate generators proposing a `role` (attended-only) or richer metadata should
record it in whatever your generator's own candidate schema is; it is out of scope for this
contract's `related[]` shape unless/until that shape is extended.

### 1.2 Allowed `type` values (exact, from `RELATIONSHIP_TYPES`)

```
located_at, occurred_at, attended, founded, employed_by, member_of, related_to,
depicts, cites, governed_by, part_of, successor_of, caused, enabled, influenced,
participated_in, overturned, commemorates, authored, invented, co_invented,
improved, developed, designed, led_development_of, built_on, commercialized,
assigned_to, licensed_to, manufactured_by, demonstrated_at, collaborated_with,
mentored_by, litigated_with, documented_by, other
```

36 values total. `caused`, `enabled`, `influenced`, `participated_in`, `overturned`,
`commemorates` are documented as the "historical-causation edges"; `authored` is a
creation-attribution edge distinct from `founded` (orgs/institutions only — `authored` is for
publications/artifacts); `invented` through `documented_by` are the invention-contribution,
commercial-context and human-network edges. Full per-type direction/temporal semantics table is
in §2's matrix and verbatim in `RELATIONSHIP_TYPE_SEMANTICS`.

The database CHECK constraint additionally admits five predicates nothing writes as a graph edge
(`served_as`, `succeeded`, `challenged_law`, `funded_by`, `published`), listed as
`LEGACY_DB_RELATIONSHIP_TYPES`. They have no direction or temporal semantics and are not
authorable — the same names are real elsewhere as *claim* predicates, which is a different
vocabulary.

### 1.3 Direction semantics

Every relationship reads as a sentence: **"fromEntity `<TYPE>` toEntity."** This is the single
documented source of truth (`RELATIONSHIP_TYPE_SEMANTICS` in `relationship.ts`) — do not guess.

On the authoring (`CatalogRelatedEntry`) side, `endpointsFromCatalogEntry` resolves direction like
this:

- `direction: 'outgoing'` → `fromEntityId = <the entity carrying this related[] entry>`, `toEntityId = entry.id` (the neighbor). Read as: "this entity `<TYPE>`s the neighbor."
- `direction: 'incoming'` → `fromEntityId = entry.id` (the neighbor), `toEntityId = <the entity carrying this related[] entry>`. Read as: "the neighbor `<TYPE>`s this entity."

**Rule of thumb:** pick the direction so the *subject* of the semantic sentence in
`RELATIONSHIP_TYPE_SEMANTICS` is `fromEntity`. E.g. for `commemorates` ("fromEntity
(place/artifact/event) COMMEMORATES toEntity (person/event/movement)"), a museum entity linking to
the person/org it commemorates uses `direction: 'outgoing'`; the commemorated entity linking back
uses `direction: 'incoming'`.

### 1.4 Evidence requirement — exact relationship claim on the from entity

Every canonical `EntityRelationship` requires at least one evidence id
(`assertRelationshipHasEvidence` in `relationship.ts`; `evidenceIds: z.array(...).min(1)` in
`entityRelationshipSchema`). This is enforced concretely in
`extractCatalogRelationships` (`packages/domain/src/graph/catalog-related.ts`):

- `resolveEvidenceIds` examines only the resolved **from** entity. It accepts a claim only when
  `claim.predicate === relationship.type`, `claim.object === relationship.toEntityId`, the
  claim has a stable id, and `citationHref` is HTTP(S).
- Claims on the to entity, unrelated claims on the from entity, matching names/aliases, and
  co-mention do not establish the edge. Without an exact cited relationship claim, extraction
  skips the edge with `no exact cited relationship claim`.
- An unsupported `type` (not in `RELATIONSHIP_TYPES`) is also skipped:
  `\`${entity.id} -> ${entry.id}: unsupported relationship type "${entry.type}"\``.
- A `related[]` entry pointing at an entity id absent from the input set is also skipped.
- An exact `mentionedEntityIds` token can add a `related_to` candidate only when the from entity
  carries its own cited `related_to` claim naming that resolved target. Mentions never borrow
  another predicate or resolve an alias into an edge by themselves.

**Practical consequence for authors/generators:** before proposing `related[]`, write down the
exact from entity, type, target id, and cited claim supporting that sentence. A generic claim on
either endpoint is insufficient. If the exact claim is absent or uncited, extraction drops the
edge and reports it in `skipped[]`.

### 1.5 Dedup and canonical direction

`extractCatalogRelationships` dedupes reciprocal fixture entries that resolve to the same directed
pair (e.g. entity A lists `{id: B, type: X, direction: outgoing}` and entity B separately lists
`{id: A, type: X, direction: incoming}`) into a **single** `EntityRelationship`:

- `dedupKey(fromEntity, toEntity, type)` preserves the ordered endpoints and joins them with the
  type. It is directed; lexicographic sorting is not used to canonicalize relationship direction.
- **Canonical direction preference: the `outgoing` entry wins for a shared directed key.** If an
  `outgoing` entry is seen for a key, it overwrites any prior `incoming` entry for that key. An
  `incoming` entry only sets the canonical record if no entry exists yet for that key.
- Entities are processed in id-sorted order (`sortedEntities`), so replacement of an incoming
  entry by an outgoing entry for the same directed key is deterministic.
- `timespan` is carried through from whichever entry became canonical.

**Practical consequence:** one side authoring `outgoing` (or the other authoring `incoming`) is
sufficient for one directed edge. Opposite directed assertions and distinct predicates remain
separate edges. If reciprocal entries describe the same directed edge, keep the `type` and
`timespan` aligned because only one record survives that directed key.

### 1.6 `role` — only on `attended`

```
RELATIONSHIP_ROLES = ['organizer', 'speaker', 'participant']
```

`role` is meaningful **only** on `type: 'attended'` edges (person attended event).
`assertRelationshipRoleValidForType` throws if `role` is set on any other type. Use it to
distinguish organizing/speaking weight from rank-and-file attendance **without** minting a new
edge type — do not invent a `type` variant for "keynote speaker at a march" when `attended` +
`role: 'speaker'` is the correct encoding. `role` is not part of the `CatalogRelatedEntry`
authoring shape (§1.1) today; it is set on the canonical `EntityRelationship` by whatever process
promotes a candidate to a published edge.

### 1.7 `timespan` — when to set it

`timespan: TemporalContext = { label?, validFrom?, validTo? }`. Whether it's required depends on
the type. `RELATIONSHIP_TYPE_SEMANTICS` marks exactly **four** types
`requiresTemporalContext: true` (enforced by `assertRelationshipTemporalRequirement`, fails
closed if `validFrom` is missing):

```
caused, enabled, influenced, overturned
```

Note: the module doc comment groups six types together as "historical-causation edges" —
`caused`, `enabled`, `influenced`, `participated_in`, `overturned`, `commemorates` — but only the
four above actually carry the hard `requiresTemporalContext: true` flag.
`participated_in` and `commemorates` both have `requiresTemporalContext: false`; their own
semantics only say `validFrom`/`validTo` "bound the participation window" (optional) or "may
record the dedication/commemoration date; not required," respectively. Always check the
`requiresTemporalContext` flag (or `CAUSAL_HISTORICAL_RELATIONSHIP_TYPES`, which is derived from
it) per type — do not infer a hard requirement from the prose grouping alone.

For every other type, `timespan` is optional but recommended whenever the fixture has a real date:
`located_at`/`employed_by`/`member_of`/`governed_by`/`part_of` all use it to bound an
occupancy/employment/membership/governance/containment window (open-ended = still true today).

---

## 2. Kind-Pair Matrix

`EntityKind` vocabulary (`packages/domain/src/entity-kinds.ts`), 12 values:

```
person, place, school, organization, institution, event, law, case, publication,
artifact, movement, other
```

For each pair below: **expected `type`(s)**, **canonical direction** (which kind is `from`), a
one-line rationale, and a concrete Black-history example. Examples are drawn from
`packages/ops-data/fixtures/records.ts` where they exist and are marked illustrative otherwise.

| Kind pair | Type(s) | Direction (from → to) | Rationale | Example |
|---|---|---|---|---|
| person ↔ event | `attended` (+ optional `role`) | person → event | Discrete event attendance; use `role: organizer\|speaker\|participant` for weight, not a new type. | A person entity `attended` the March on Washington, `role: 'speaker'`. |
| person ↔ event (broader) | `participated_in` | person → event/movement/campaign | Sustained involvement broader than one dated event — use instead of `attended` when there's no single day/venue. | A person `participated_in` the Selma to Montgomery Marches campaign (fixture: `ent_selma_to_montgomery_marches_001`) as a sustained multi-day effort, vs. `attended` for one specific march date. |
| person ↔ movement | `member_of` or `participated_in` | person → movement | `member_of` for a documented, joinable movement organization; `participated_in` for broader movement involvement without formal membership. | A person `member_of` the Civil Rights Movement (fixture: `ent_movement_civil_rights_movement`), or `participated_in` if involvement was diffuse. |
| person ↔ organization | `founded`, `employed_by`, `member_of` | person → organization | `founded` at creation (point in time); `employed_by` for paid staff role; `member_of` for rank-and-file/organizational membership. | E.D. Nixon `founded` the Montgomery Improvement Association; a staffer `employed_by` the National Urban League; a rider `member_of` the Brotherhood of Sleeping Car Porters. |
| person ↔ institution | `founded`, `employed_by`, `member_of` | person → institution | Same three as organization — `institution` and `organization` share the `founded`/`employed_by`/`member_of` semantics verbatim in `RELATIONSHIP_TYPE_SEMANTICS`. | A curator `employed_by` the Museum of African American History. |
| person ↔ school | `employed_by`, `founded`, `member_of` | person → school | Schools are a distinct `EntityKind` from `institution`/`organization` but the same edge types apply structurally (faculty/founder/student-body-adjacent membership). | A founding faculty member `employed_by` Howard University; a founder `founded` Fisk University (if founding is separately attested from the school's own founding claim). |
| person ↔ place | `located_at`, `part_of` (rare) | person → place | `located_at` bounds where a person resided/was based; `part_of` does not apply to persons (containment is place/place or place/institution). | A person `located_at` the Sweet Auburn district (fixture: `ent_sweet_auburn_001`). |
| person ↔ publication | `authored`, `depicts` (as object) | person → publication (authored); publication → person (depicts) | `authored` = creation attribution (person wrote/edited it); `depicts` = the publication's content is *about* the person, reverse direction. | A person `authored` the Chicago Defender (as founder/editor) — or, if the publication *profiles* a person, that publication `depicts` the person. |
| person ↔ case | `cites`, `related_to` | case → person (or person → case) | No dedicated "party to a case" type exists; `cites` covers a documented connection (e.g. a case's holding affecting a named plaintiff/figure) without overclaiming causal weight. Prefer `cites` over `related_to`. | Linda Brown `cites`-linked to Brown v. Board of Education of Topeka (or `related_to` if the connection is looser than a documented citation). |
| person ↔ law | `governed_by`, `cites` | person → law | `governed_by` when a law's provisions concretely bound/protected the person (e.g. enfranchised by, or subject to). | A formerly enslaved person `governed_by` the Thirteenth Amendment to the U.S. Constitution. |
| event ↔ place | `occurred_at` | event → place | Canonical "where did it happen" edge. | The Selma to Montgomery Marches `occurred_at` Selma, Alabama. |
| event ↔ movement | `part_of`, `participated_in` (rare) | event → movement | An event resolves into (is `part_of`) the sustained movement it belongs to — matches `entity-kinds.ts`'s own doc comment: "individual events/organizations resolve into [a movement] via `part_of`." | The March on Washington `part_of` the Civil Rights Movement. |
| event ↔ organization | `related_to`, `cites` | organization → event (or event → organization) | No dedicated "org held/organized event" type; `attended`+`role:'organizer'` covers a *person* organizing, but org-to-event has no closer fit than `related_to`/`cites`. Prefer `cites` if a source documents the connection concretely. | Montgomery Improvement Association `cites`-linked to the Montgomery Bus Boycott (fixture shows the inverse: a church `related_to` the Montgomery Bus Boycott, `ent_montgomery_bus_boycott_001`, `direction: incoming`). |
| movement ↔ organization | `member_of` | organization → movement | An organization can be a `member_of` a movement (mirrors person `member_of` movement) when the org itself formally aligned/joined. | Council of Federated Organizations (COFO) `member_of` the Civil Rights Movement. |
| law ↔ case | `overturned`, `cites`, `governed_by` | case → law (overturned); law ↔ case (cites) | `overturned` is explicitly "fromEntity (case/law) OVERTURNED toEntity (a prior case/law)" — legal supersession, requires `validFrom`. `cites` for a case citing a law's provisions without overturning it. | Brown v. Board of Education of Topeka `overturned` Plessy v. Ferguson — note this is case↔case (below), not law↔case; for a genuine law↔case pair: a case `cites` the Fourteenth Amendment as its constitutional basis. |
| case ↔ case | `overturned` | later case → earlier case | Legal supersession is the only edge purpose-built for this pair. | Brown v. Board of Education of Topeka `overturned` Plessy v. Ferguson (`validFrom` = 1954 decision date). |
| organization ↔ organization | `successor_of` | modern/successor org → superseded org | "fromEntity (the modern successor) is SUCCESSOR_OF toEntity (the superseded historical predecessor)." No real fixture example currently exists in the catalog (see §3) — illustrative only. | A hypothetical modern civil-rights coalition `successor_of` a defunct 1960s-era predecessor organization it formally absorbed/continued. |
| place ↔ place | `part_of` | finer place → coarser place | Containment chain (`located_at`/`part_of` walked by `resolveEntityContainmentPaths` in `graph/containment.ts`): spot → city → county → state. | Sweet Auburn (neighborhood) `part_of` Atlanta. |
| institution ↔ place | `located_at` | institution → place | Same occupancy semantics as person↔place, applied to a fixed-site institution. | A museum entity `located_at` its city. |
| publication ↔ person / event | `authored` (person→pub), `depicts` (pub→person/event) | see type | `authored`: person created the publication. `depicts`: publication's content is about the person/event — direction flips from `authored`. | Frederick Douglass `authored` The North Star; The Negro Motorist Green Book `depicts` era travel conditions for Black motorists (illustrative — `depicts` target would more precisely be an event/practice, not a fixture entity today). |
| artifact ↔ institution | `located_at` (artifact housed at institution), `depicts` (artifact depicts something) | artifact → institution (located_at) | An artifact (e.g. a physical object, photograph, monument) is `located_at` the institution that holds/displays it. No `artifact`-kind entities exist in the catalog fixtures today (see §3) — illustrative only. | A civil-rights-era protest sign artifact `located_at` the National Museum of African American History and Culture (illustrative; not a real fixture entity). |

### Pairs with no meaningful edge

- **school ↔ school**, **case ↔ movement**, **law ↔ movement**, **artifact ↔ artifact**: no
  dedicated type fits and no catalog precedent exists; if a real connection needs recording, fall
  back to `related_to` (or `cites` if a source documents the specific connection) rather than
  forcing one of the pairs above.
- **event ↔ law**, **event ↔ case**: no direct edge type exists; a law/case *responding to* an
  event is better modeled as `cites` (the law/case documents/references the event) since no
  causal-edge (`caused`/`enabled`) can be asserted without clearing the consensus-causation
  guardrail (§3.4/§1 in `evaluateCausalEdgeGuardrail`).

---

## 3. Guidance for Candidate Generators

### 3.1 Picking the single best type

Order of preference when more than one type could plausibly apply:

1. **Most specific type that matches the documented relationship's actual shape** — e.g. if a
   person is documented as having *founded* an organization, use `founded`, not `member_of`
   (which loses the founding-specific claim) and not `related_to`.
2. **`cites`** when a source documents a connection but no stronger type's semantics are actually
   met — e.g. two entities co-mentioned in the same fact record without an attendance/employment/
   causal claim. This is also the mandated landing type for contested or single-incident causal
   claims that fail the `caused`/`enabled` guardrail (§3.4).
3. **`related_to`** only when there genuinely is no stronger typed fit and no citable specific
   connection — "loose association" per its own documented semantics. Treat `related_to` as a
   last resort, not a default.
4. **`other`** only when the connection is real but doesn't fit any of the 19 typed edges even
   loosely — rare; if you find yourself reaching for `other` repeatedly for a recurring pattern,
   that's a signal the taxonomy is missing a type (flag it, don't silently paper over it).

Never invent a new `type` string outside `RELATIONSHIP_TYPES` — `extractCatalogRelationships`
silently skips unsupported types (§1.4), so a made-up type does not fail loudly; it just vanishes.

### 3.2 Avoiding over-linking

- Do not propose an edge for every co-occurrence in a source document. An edge should represent a
  claim worth surfacing in the public adjacency view, which is itself bounded
  (`DEFAULT_ADJACENCY_CAP = 25` per entity, ranked by evidence count, per
  `packages/domain/src/graph/adjacency.ts`) — low-value `related_to`/`other` edges crowd out
  higher-value typed edges in that ranking.
- Prefer one well-typed edge over several vague ones. If a person both attended an event *and*
  was a member of the organizing movement, author both — but each must be its own edge with its
  own type, not one blended `related_to`.
- `caused` and `enabled` are reserved for **consensus, citable, systemic** historical causation
  (e.g. HOLC redlining causing measurable disinvestment) and gated by
  `evaluateCausalEdgeGuardrail`/`assertCausalEdgeGuardrail`: a `contested_or_single_incident` scope
  is always rejected, and a `systemic_consensus` scope without a documented `consensusBasis` is
  also rejected. A contested or single-incident causal claim (e.g. "this specific statute enabled
  this specific act of violence") must route through `cites` instead — never assert it as a
  causal edge with the same confidence as a settled claim.

### 3.3 Living-person caution

- Person entities carry `livingStatus` (`packages/domain/src/entity.ts`); unknown status is
  treated as living by default (`DEFAULT_LIVING_STATUS = 'unknown'`,
  `packages/domain/src/living.ts`) — **never assume deceased** absent positive evidence
  (`deriveLivingStatus` can only assert `'deceased'` from a documented death year or an
  implausible age > 115 years; it never independently asserts `'living'` from absence of
  evidence).
- For a relationship whose evidence touches a living (or unknown-status) person, treat it with
  the same elevated scrutiny as the UGC living-person rules in
  `packages/domain/src/rights/living-person-ugc.ts`: no cross-source aggregation of a personal
  detail field into a single profile-shaping claim, and UGC-derived claims about a living person
  must clear the high-impact publish confidence threshold. Candidate generators proposing edges
  sourced from user-generated content about a living person should flag them for elevated review
  rather than auto-promoting.
- Never propose a `depicts`/`cites`/`related_to` edge that would deanonymize a pseudonymous or
  anonymous UGC subject — this is a hard, fail-closed prohibition
  (`assertNoDeanonymization`), not a judgment call.

### 3.4 Every proposed edge must cite its backing evidence

Because `extractCatalogRelationships` resolves `evidenceIds` from the resolved from entity's
exact relationship claim (§1.4), a candidate generator must, for every proposed `related[]` entry:

- Identify the **from entity**, exact predicate, exact target id, and claim that supports the
  directed sentence. Confirm that claim exists (or will exist) in the from entity's `claims[]`
  array with a real `citationSource`/`citationHref`. An edge with no exact cited relationship
  claim on the from entity is dropped at extraction (`skipped[]`), so generators must self-verify.
- For `caused`/`enabled` specifically, also supply the `CausalEdgeReview.scope` and (if
  `systemic_consensus`) the `consensusBasis` string identifying the secondary-source consensus —
  this is a structural intake requirement, not optional metadata.
- For any of the four temporal-required types (`caused`, `enabled`, `influenced`, `overturned`),
  supply at least `timespan.validFrom` or the edge fails `assertRelationshipTemporalRequirement`.

---

## Appendix: coverage note

The checked-in seed record fixture at `packages/ops-data/fixtures/records.ts` exercises only a
small subset of the relationship vocabulary, including `occurred_at` and `commemorates`.
The matrix above describes the domain semantics and authoring choices; it is not a census of
active release coverage. Treat examples without a cited record or release fixture as
illustrative until a reviewed projection and exact relationship claim exist.

Types with no natural kind-pair home should use `related_to` only when the from entity has an
exact cited `related_to` claim naming the target. Do not add a generic edge to compensate for
missing evidence or an absent entity kind.
