# Decisions carryover

Still-binding invariants extracted from ADR/decision docs removed 2026-07-24
(`repo-xez5.11` docs purge). History is preserved in git (`git log -- docs/adr/`,
`docs/prds/`, `docs/memos/`, `docs/meetings/`, `docs/notes/`, `docs/bb-001/`,
`docs/mobile/decisions/`). Only rules not already stated in a surviving doc are
listed here; most invariants from the removed ADRs were already restated in
`docs/data/`, `docs/security/`, `docs/mobile/security/threat-model.md`, and
`docs/relationship-taxonomy.md`, and did not need duplication.

- **Mobile client never imports server-only packages.** `apps/mobile` must never import
  `packages/domain` or `packages/firebase` directly — those packages carry Node/`firebase-admin`
  dependencies and are server-side only. The mobile app reads exclusively through
  `apps/api-public`, sharing only environment-neutral wire types from `packages/public-contracts`.
  (from ADR-022, "mobile data boundary")

- **Admin never edits active public projections directly.** Changes to what the public site
  serves must go through the publication workflow (preview → promote / release activation), never
  a direct write to the active public projection tables. (from ADR-004, "public projection and
  immutable publication snapshot model")

## Addendum, 2026-07-24 (repo-xez5.10): entity source-of-truth precedence

Entities exist in four places today (git fixtures, Firestore `canonicalEntities`, Supabase
`bb_canonical.entities`, in-code hand-curated tables). This restates and extends the ADR-020
precedence rule now that `docs/adr/` has been purged (`repo-xez5.11`):

- **Supabase `bb_canonical.entities` is the system of record.** It is the only place that a
  canonical entity is created, promoted, merged, or edited going forward.
- **Git fixtures (`packages/firebase/fixtures/national-catalog/`) are one-way seed input**,
  consumed by an import lane into `bb_canonical`. They are never re-exported from Supabase, and
  never hand-edited after their initial import — an entity that needs a correction is corrected in
  Supabase, not in the fixture file that seeded it.
- **The Firestore path (`canonicalEntities`) is retired.** `publish-national-catalog.ts`, the
  write path this rule originally flagged as drift, no longer exists in the repo (removed ahead of
  `repo-348e.8`) and Firestore itself has no live database, rules, or indexes left
  (`repo-348e` epic; `docs/data/firebase-wind-down.md`). Do not add new Firestore entity-write call
  sites — there is no Firestore config left to deploy them against.
- **In-code hand-curated entity/reference tables** (e.g. `MENTION_OVERRIDES` in
  `packages/domain/src/graph/mention-resolver.ts`) should be data files with provenance metadata,
  loaded at runtime, not literals in source — so curation edits don't require a code deploy. See
  `docs/research/entity-source-drift-audit.md` for the audit and what was moved under this rule.
