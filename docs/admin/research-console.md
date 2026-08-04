# Administration and research console

The private admin portal lives in `@repo/admin` (Cloud Run + IAP target), separate from the
public web application. Primary desks are ops-first:

| Desk | Path | Role |
|------|------|------|
| Ops | `/` | Post-login landing; queue posture, env strip, deep links |
| Inbox | `/inbox` | Pending research cases with full detail + live transitions |
| Cases | `/cases`, `/cases/[id]` | All research-case states + deep detail |
| Catalog | `/catalog` | Canonical entities and places |
| Stories | `/stories/review` | Story packet review (approve ≠ publish) |
| Sources | `/sources` | Source organization registry |
| Releases | `/releases` | Release manifests + privileged stage activate/rollback |
| More | Quick add, evidence, graylist, audit, switches, legacy `/console` | Intake and safety |

Sign-in defaults to Ops (`/`). A safe `?next=` path (for example the desk that bounced the
operator to login) is honored; open redirects are rejected.

## Live research triage

Inbox and Cases call `/api/research-cases` (list, detail, transition, bulk-transition, assign).
Transitions use domain `transitionResearchCase` + `commitWithAudit` and never write public
projections. Product verbs: Send to relevance, Confirm relevance, Needs evidence, Exclude, Merge.

## Authorization boundary

All mutation handlers must import the existing server authorizer from
`apps/admin/src/auth/server-authorization.ts` / `request-auth.ts`. Do not reproduce its IAP or
Firebase checks in client code.

1. Normal actions call `assertPermission` with the action's declared permission (research writes
   today authorize via verified Firebase session in `ADMIN_AUTH_MODE=firebase`).
2. High-impact release staging requires a durable operator reason; full activation still needs
   signed-manifest verification in this runtime.
3. The verified actor, reason, and resulting state must be included in the append-only audit event.

Browser state, route visibility, hidden buttons, and IAP alone are not authorization. Research
roles cannot publish or retract. Publication roles cannot mutate research workflow state.
`useAdminPermissions` is display-only.

## Canonical writes

The entity workbench edits `bb_canonical.entities` directly. That reverses the console's earlier
"admin never mutates canonical" rule for the record itself; see the 2026-08-04 entry in
[`docs/decisions-carryover.md`](../decisions-carryover.md) for why and what did not change.

Every canonical write goes through `commitCanonicalWrite`
(`apps/admin/src/lib/canonical-write.ts`) — there is no second path. It resolves the verified
staff identity from the session, checks the role against the verb's permission, and hands the
state change to `commitWithAuditPostgres`, which writes domain state, the audit event, and the
outbox message in one transaction. A canonical write without an audit row cannot exist.

| Verb | Permission | Roles |
|------|-----------|-------|
| `entity.field_edit` | `canonical:write` | admin, research |
| `entity.merge` | `canonical:merge` | admin |
| `entity.merge_reverse` | `canonical:merge` | admin |
| `entity.bulk_kind_reassign` | `canonical:bulk_write` | admin |

`apps/admin/src/auth/staff-permissions.ts` is the single role→permission table; the server gate
and `useAdminPermissions` both read it, so a hidden button and an enforced permission cannot
drift apart. Every write requires a non-empty operator reason, and the audit actor is always the
verified session identity — never an operator id submitted with the form.

## Merging entities

Select two or more records in the workbench and choose Merge (`/catalog/merge?ids=…`). The
survivor keeps its own name, kind, and sensitivity; everything the absorbed records own moves to
it, and the absorbed records stay in the archive marked `merge_state.status = 'absorbed'`.

**A merge moves rows and never deletes them.** A row that cannot move cleanly stays with the
absorbed record and is reported on the survivor's page. The live schema produces exactly three
such cases: an `entity_relationships` edge or an `event_participation` row whose endpoints would
both become the survivor (a self-loop is not a fact about anything), a participation row that
would violate `UNIQUE (event_id, participant_id, role)`, and the single-row-per-entity tables
`entity_embeddings` and `entity_reconciliation_status`, where the survivor's own row wins.

Because nothing is destroyed, the merge is reversible in the literal sense: `applyState` returns
the id of every row it moved and where it came from, that record is written onto the merge's audit
event, and Reverse this merge (on the survivor's page) reads it back and repoints each row.
Merges made before this existed — including the two from
`packages/ops-data/scripts/merge-duplicate-hubs.ts`, which resolves collisions by deleting the
losing rows — have no reversal record and are shown as not reversible rather than offering a
button that would fail.

A merge is a canonical decision and does not touch `bb_public.release_entities` or
`bb_public.search_index`. The next release build reads canonical; the signed manifest is still the
only thing that changes what is live.

## Query timeouts

Desks are server components, so first byte blocks on Postgres. The pool carries a connect
timeout, a `statement_timeout`, and a client-side query timeout
(`apps/admin/src/lib/postgres-client.ts`, overridable via `DATABASE_CONNECT_TIMEOUT_MS`,
`DATABASE_STATEMENT_TIMEOUT_MS`, `DATABASE_QUERY_TIMEOUT_MS`). Page reads wrap in
`readPostgresOrDegrade`, which turns an unreachable database into a banner in about five seconds
instead of a render that hangs for minutes. Genuine query errors still throw — degradation must
not hide broken SQL.

## Publication safety

Console and release actions may target canonical drafts or immutable release candidates. They must
never target `/api/public/**`, an active projection document, or a public release snapshot in place.
Retraction and rollback use release replacement semantics.

Bulk research transitions enforce a 50-item limit and reject duplicates.

## Human enablement remaining

Before production enablement, a human platform administrator must still:

1. Deploy `apps/admin` to its private Cloud Run service with the dedicated admin service account.
2. Enable IAP and grant access only to the approved workforce group.
3. Wire layered IAP verification when `ADMIN_AUTH_MODE=layered`.
4. Connect Firebase custom-claims policy for research vs publication roles.
5. Complete signed-manifest verification for live release activation.
6. Keep Firestore client rules deny-by-default for canonical, publication, audit, and operations
   collections.

See ADR-011 for the Firestore system-of-record boundary and the research-case workflow guide for
publication and retraction invariants.

Legacy `/console/<workspace>` fixtures remain for workspaces not yet promoted into first-class
desks; live triage no longer depends on disabled “Preview action” cards.
