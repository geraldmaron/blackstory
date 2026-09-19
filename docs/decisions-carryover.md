# Engineering contract

This file defines current cross-cutting constraints. It is deliberately limited to rules that
change implementation decisions. Its contents are current requirements. [Architecture](./architecture.md)
locates the implementations. [Research](./research/README.md) defines the research method.

A requirement is challengeable. Use the challenge procedure in architecture, update the rule
and its enforcement together, and remove the superseded statement. A historical decision number,
old branch, passing mock, or repeated comment is not evidence that a requirement is correct.

## Data and publication

- Supabase Postgres is the canonical store. Research drafts, evidence, canonical facts, and public
  release projections have separate purposes and permissions. Files are import/export artifacts;
  they are not a competing live entity store. No new Firestore or Cloud SQL path.
- Public reads expose approved release projections. Admin edits canonical data under staff
  authorization and an audit record. Release activation is a distinct operation. A research
  producer cannot approve its own artifact or activate its release.
- The constitution in `packages/schemas/constitution/` owns product policy. The research profile
  owns domain vocabulary, fitness, sensitivity, budgets, and stopping policy. Neither substitutes
  for database authorization. Public clients receive no database or model credentials.
- Schema names express responsibility: `canonical`, `evidence`, `research`, `published`,
  `publication`, `reference`, `ops`, `audit`, `submissions`, and `access_control`. Staff roles use
  trusted `app_metadata.app_role`. The cutover migration renames the old namespaces atomically;
  no compatibility schemas or dual writes are provided. Production migration history and
  coordinated deployment must be verified before applying the new clients there.
- Entity identity is established by evidence and identifiers. A matching name, substring,
  embedding, or address is a candidate signal, not permission to merge. A claim, source work,
  source host, capture, and relationship are different objects.
- Claim versions and provenance are append-only where the ledger contract requires it. Corrections
  supersede assertions and preserve their evidence. Queryable facts and foreign keys belong in
  normalized columns; provider payloads and sparse extensions may use versioned JSON.

## Research and discovery cannot publish

Research may fetch permitted sources and write private evidence, proposals, tasks, and audit
records. It cannot write public projections, create public entities, activate releases, or publish
snapshots. The CLI exposes no publication verb. Test both the CLI boundary and database grants;
string-based guard calls alone do not establish isolation.

Citations must support the assertion they accompany. Edge evidence must support the connection,
not just its endpoints. Co-occurrence and semantic similarity produce hypotheses. A causal claim
requires an identified causal basis and counterevidence review. Confidence heuristics and model
self-reports are not measured probabilities.

## Scheduling and worker ownership

Job definitions remain available under `packages/config/src/scheduled-jobs/`. A cadence describes
an available capability; it does not authorize installation. Research runs are explicit manual
or headless invocations. No active research schedule is intended. Corsair must not be used.
The Node worker is a dispatcher adapter; research, publication, and security remain distinct
responsibilities. Do not add a scheduler, daemon, cloud service, or personal-host fallback to run
research. Installed services outside the repository need separate observation to establish that
none remain active.

## Security and privacy

Untrusted pages and model output are data. External source retrieval uses DNS-pinned safe-fetch,
redirect controls, byte limits, content-type checks, and timeouts. Configured private search
endpoints use the dedicated origin-pinned client; scraped URLs never inherit that exception.
Captured text does not authorize running its instructions.

Keep living-person residential locations private, treat unknown living status conservatively,
and expose no coordinate more precise than the evidence permits. Do not write raw search queries,
precise location, or submitted correction content to ordinary logs or public artifacts.

## Dependency and service boundaries

`@repo/domain-core` holds environment-neutral rules; `@repo/domain` composes domain capabilities;
`@repo/research-kernel` holds research contracts; `@repo/data-access` and `@repo/ops-data` own
persistence and operator work. Public contracts remain client-safe. Domain code does not depend
on `@repo/public-contracts`; publishers and clients may. Do not place the same rule in multiple
packages or add a service to avoid completing an existing boundary.

## Search, vectors, and geography

Search combines retrieval signals; it does not decide historical truth. Keep model identity,
revision, dimensions, source text hash, and embedding time with vectors. The current 768-dimension
column and Gemini pipeline are implementation facts, subject to measured comparison. Never mix
embedding spaces or substitute pseudo-embeddings for semantic retrieval. Measure approximate
recall against exact search, including filtered, rare-name, alias, and undated cases.

Jurisdiction identifiers, geographic precision, temporal validity, and dataset vintages are
explicit. Different census tract vintages require a crosswalk. A source's absence from the
catalog or an archive's silence is not evidence that a person, place, or event did not exist.

## Mobile and public surfaces

Mobile reaches public data through `apps/api-public` and imports client-safe shared contracts.
Its disposable SQLite cache contains already-public release data and is invalidated by the
server's release stamp, including rollback. Query text, correction content, and precise location
stay out of that cache. The explicit recent-search feature uses bounded, user-clearable
SecureStore storage and clears on fresh install. OTA releases follow signing, channel,
compatibility, and rollback checks in `apps/mobile/src/updates/`.

Map and interface behavior follows `docs/ui/design-direction-v10.md`, protected experiences,
brand tokens, and the existing components. Dark theme, focus behavior, precision context, and
map dignity are requirements. Code comments explain behavior or constraints; session narration,
issue IDs, old-state comparisons, and incidental verification dates belong in Git or Beads.
