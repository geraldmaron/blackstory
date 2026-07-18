# Administration and research console

The private console shell lives at `/console` in `@blap/admin`. It is a Cloud Run + IAP
target, separate from the public web application. BB-056 provides route shells, deterministic
fixtures, guard contracts, and accessible interaction patterns; it does not connect mutation
handlers or apply cloud configuration.

## Workspaces

- Candidate queue
- Relevance review
- Entity resolution
- Source registry and adapter status
- Research cases
- Claims, evidence, contradictions, and confidence
- Submission moderation
- Publication preview and release
- Retraction and rollback
- Audit explorer
- Security and operations
- Feature and kill switches

Each workspace is routed under `/console/<workspace>`. The route displays fixture records,
the required permission for every action, and the publication diff that would result. Controls
remain disabled until trusted server handlers are connected.

## Authorization boundary

All mutation handlers must import the existing server authorizer from
`apps/admin/src/auth/server-authorization.ts`. Do not reproduce its IAP or Firebase checks in
client code.

1. Normal actions call `assertPermission` with the action's declared permission.
2. High-impact actions call `assertPrivilegedAction`, which applies permission checks and
   recent Firebase reauthentication policy.
3. High-impact requests also require a non-empty, durable operator reason.
4. The verified actor, reason, authorization decision, and resulting publication diff must be
   included in the append-only audit event.

Browser state, route visibility, hidden buttons, and IAP alone are not authorization. Research
roles cannot publish or retract. Publication roles cannot mutate research workflow state.

## Publication safety

Console actions may target canonical drafts or immutable release candidates. They must never
target `/api/public/**`, an active projection document, or a public release snapshot in place.
Publication builds and previews a release candidate before a separately authorized activation.

Retraction and rollback use release replacement semantics:

1. Build a replacement manifest that omits or restores the affected records.
2. Show its added, changed, removed, and unchanged counts.
3. Obtain a fresh-authenticated publication decision with a reason.
4. Sign and activate the replacement release through the BB-019 release lifecycle.
5. Retain the prior immutable manifest, pointer history, reason, and audit event.

Bulk actions require a preview, enforce the lower of the action-specific limit and the global
50-item limit, reject duplicates, and issue a rollback token. Preview generation never implies
execution.

## Human enablement remaining

No live IAP, Firebase, Cloud Run, Firestore, or Remote Config change is part of BB-056. Before
enabling the console, a human platform administrator must:

1. Deploy `apps/admin` to its private Cloud Run service with the dedicated admin service account.
2. Enable IAP for that backend and grant access only to the approved workforce group.
3. Configure the expected IAP audience and email domain for the deployed service.
4. Connect Firebase Admin token verification with revoked-token checking and the existing
   custom-claims policy.
5. Implement server-only handlers that compose the console guards with Firestore transactions,
   audit/outbox writes, and the BB-019 release service.
6. Keep Firestore client rules deny-by-default for canonical, publication, audit, and operations
   collections.
7. Connect feature and kill-switch reads to reviewed runtime configuration; do not let browser
   clients write switch state.
8. Exercise permission denial, stale authentication, release diff, rollback, keyboard, zoom,
   and screen-reader checks in staging before granting production access.

See ADR-011 for the Firestore system-of-record boundary and the research-case workflow guide for
publication and retraction invariants.
