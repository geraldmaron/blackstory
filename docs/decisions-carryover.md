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
- **The Firestore path (`canonicalEntities`, and `publish-national-catalog.ts`'s writes to it) is
  retired**, per the wind-down checklist tracked in `repo-atya` (ledger cutover to Postgres — see
  `docs/runbooks/overnight-hybrid-enrichment.md` for the parity-cycle gate before the legacy path
  is fully removed). As of this writing `publish-national-catalog.ts` still writes
  `canonicalEntities/*` directly; that is known drift against this rule, not an endorsement of it
  — do not add new Firestore entity-write call sites, and treat existing ones as follow-up work for
  `repo-atya`, not as precedent.
- **In-code hand-curated entity/reference tables** (e.g. `MENTION_OVERRIDES` in
  `packages/domain/src/graph/mention-resolver.ts`) should be data files with provenance metadata,
  loaded at runtime, not literals in source — so curation edits don't require a code deploy. See
  `docs/research/entity-source-drift-audit.md` for the audit and what was moved under this rule.
