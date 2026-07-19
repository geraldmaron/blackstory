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
