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

## Case → canonical entity promotion authority lives in apps/admin (repo-k2kb, 2026-07-25)

**Problem:** the only working "research case → canonical entity" promotion path in the repo was
an untracked, gitignored script (`.cache/promote-authority-net-2026-07-23.mjs`) that ran raw SQL
by hand under a single hardcoded actor id, reused across every run. Attempting to formalize it as
an `operator-cli` verb (`promote-entity`) was correctly blocked by
`packages/operator-cli/src/promotion-boundary.test.ts`, which proves operator-cli must never
expose a promote/approve/publish/activate/retract capability — proposer and approver must be a
distinct call, distinct identity.

**Decision:** promotion authority lives in `apps/admin`, not a new CLI package.

- `apps/admin` already has a real, distinct auth boundary (Postgres roles via
  `bb_auth.current_role()`: `research`/`admin`/`publication`, enforced through
  `authorizeAdminRequest`) that operator-cli deliberately lacks. That's the natural home for an
  *approver* identity structurally separate from the *proposer* — operator-cli (or whatever
  assembled the candidate record) never carries approval authority.
- New surface: `POST /api/research-cases/[id]/promote`
  (`apps/admin/src/app/api/research-cases/[id]/promote/route.ts`), gated to the `admin`/
  `publication` roles, calling `promoteCaseToCanonical`
  (`apps/admin/src/cases/promote-case.ts`).
- The gate itself (`evaluateCasePromotionGate`,
  `packages/domain/src/promotion/case-promotion.ts`) is deliberately **not** the existing
  `evaluatePromotionGate` (`packages/domain/src/promotion/controls.ts`): that gate operates on a
  `PromotionClaim` shape (contradiction-search records, evidence-lineage reputation) this
  pipeline has never populated — forcing case data into that shape would fabricate fields no one
  actually assessed. `evaluateCasePromotionGate` is a smaller, honest gate: case must be in
  `state: 'substantial_enrichment'`, and proposer/approver identities must be non-empty and
  distinct (same core invariant as `evaluatePromotionGate`, applied at case granularity instead
  of per-claim).
- `validateCanonicalPromotionRecord` ports the content checks the ad hoc script enforced by hand
  (two independent source hosts, US coordinate bounds, well-formed decade buckets, non-trivial
  summary) so they run on every promotion instead of depending on a human remembering to check.

**Correction made while porting:** the ad hoc script wrote canonical-promotion metadata into
`bb_research.cases.publication` — but that column is typed
(`ResearchCaseRecord['publication']`, `packages/domain/src/research-case/model.ts`) for *public
release* metadata (`releaseId`/`publishedAt`/`revision`) — a later, distinct stage from case→
canonical promotion. Reusing it would have silently corrupted that field for any later release
step. `promoteCaseToCanonical` does not touch `cases.publication`; the canonical link is recorded
the same way the script already did on the entity side
(`entities.identifiers: [{scheme: 'research_case', value: caseId}]`) and via a
`case_history_events` row (`reason_code: 'canonical_promotion_approved'`).

**Status:** implemented and tested (`packages/domain/src/promotion/case-promotion.test.ts`);
`.cache/promote-authority-net-2026-07-23.mjs` is no longer the only way to do this. Not yet
exercised against a live promotion in this session — residual verification risk, tracked as a
follow-up.

**Alternatives considered:**
- A new small CLI package with its own auth/identity model — rejected, duplicates the auth
  boundary admin already has, for no benefit.
- Reusing `evaluatePromotionGate` as-is — rejected, requires data (contradiction search,
  evidence-lineage reputation) this pipeline doesn't produce; would need those fields faked.
