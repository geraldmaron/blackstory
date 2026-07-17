# Administrator identity and authorization

BB-027 implements administrator identity as two independent controls: Google Cloud IAP at the
admin service boundary and Firebase Authentication inside the application. Neither control alone
authorizes a request.

## Request authorization

`apps/admin/src/auth/server-authorization.ts` is the server composition boundary. Every protected
handler must call one of its assertions before reading administrative data or invoking an internal
workflow:

- `assertAuthenticated` for administrator reads.
- `assertPermission` for non-privileged writes.
- `assertPrivilegedAction` for publication, retraction, rights changes, policy changes, privileged
  exports, and role changes.

The helper verifies the IAP JWT through an injected verifier, verifies the Firebase ID token with
`checkRevoked: true`, requires the IAP and Firebase email identities to match, and then invokes the
application authorization policy. A client-side route guard may improve navigation, but it is never
an authorization control and cannot replace these server assertions.

The production IAP verifier must validate signature, issuer, expiry, and the exact backend-service
audience. Forwarded identity headers are not trusted without JWT verification. See
`infra/gcp/iap/README.md` and ADR-005.

## Firebase custom claims

`packages/firebase/src/admin-auth.ts` defines claims version 1:

```json
{
  "bb_claims_version": 1,
  "bb_roles": ["publication"]
}
```

Legacy single-role/boolean claims continue to resolve through `resolveStaffRoles`; new writes use
`bb_roles`. Claims contain authorization metadata only—never profile data, secrets, tokens, or MFA
recovery material.

| Role | Effective permissions |
|---|---|
| `research` | Research writes |
| `publication` | Publish and retract |
| `security` | Rights changes and privileged exports |
| `admin` | All permissions, including policy and role changes |

The `admin` role inherits research, publication, and security capabilities. Research alone never
publishes. Publication activation remains an internal workflow per ADR-005; the admin service
authorizes the human request but does not gain a direct public projection mutation path.

Role changes are server-only. `mutateAdminRoles` requires layered authorization and fresh
reauthentication before calling a trusted mutation service. That service must use `setAdminRoles`,
which runs `assertRoleMutationAuthorized`, writes Firebase custom claims with the Admin SDK, and
revokes the target user's refresh tokens. There is no client SDK role-write path.

## MFA and recent authentication

All administrator sessions require Firebase MFA. The server accepts only a verified ID token whose
authentication methods show a second factor (`firebase.sign_in_second_factor` or `amr: "mfa"`).
There are no bypass tokens.

The following actions require an authentication time no older than 10 minutes:

- publication;
- retraction;
- rights changes;
- policy changes;
- privileged export;
- role changes.

The UI should ask the user to reauthenticate with their primary credential and enrolled second
factor, then send the newly issued ID token. Extending the browser session or refreshing an old
token does not change `auth_time` and does not satisfy the gate.

## Revocation and alerts

`revokeAdminSessions` revokes Firebase refresh tokens and returns the server revocation cutoff.
Protected requests verify ID tokens with revoked-token checking; `assertSessionNotRevoked` is
available where an explicit cutoff is already loaded. Revoke sessions immediately after role
changes, suspected compromise, administrator offboarding, or MFA reset.

`AdministrativeAuthAlertEvent` defines sanitized events for login success/failure, new-device
signals, session revocation, and role changes. `emitAdministrativeAuthAlert` is an injected sink
stub; BB-027 does not select or provision an alert transport. Device and source-IP values must be
pseudonymous hashes. Events must never contain raw ID tokens, IAP assertions, passwords, factor
secrets, recovery codes, or full IP addresses.

## Human console steps

1. In Google Cloud, provision and enable the reviewed IAP/load-balancer design in
   `infra/gcp/iap/`; grant access only to the administrator group.
2. In Firebase Authentication, enable approved first-factor providers and an MFA factor supported
   for the project. Require every administrator to enroll before claims are granted.
3. Bootstrap the first administrator claim through a reviewed, audited server/Admin SDK operation.
4. Test an allowed IAP user with no Firebase role, a Firebase admin outside IAP, a non-MFA token, a
   stale authentication, and a revoked token; all must fail.
5. Configure the alert sink and route login failure, new-device, revocation, and role-change events
   to the security response channel.

No live IAP or Firebase console changes were applied by BB-027.
