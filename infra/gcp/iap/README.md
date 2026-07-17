# Administrator IAP design (BB-027)

This directory is declarative design only. No Google Cloud resource was created or changed.
[`admin-iap-policy.json`](./admin-iap-policy.json) is the reviewed fail-closed posture, and its test
protects the required IAP + Firebase Auth layering.

## Target request path

1. An external HTTPS load balancer is the only public entry point.
2. IAP admits only the dedicated administrator access group.
3. Cloud Run service `black-book-admin` uses
   `internal-and-cloud-load-balancing` ingress and has no public invoker grant.
4. The server validates the IAP JWT issuer, signature, expiry, and exact backend-service audience.
5. The server independently verifies a Firebase ID token with revoked-token checking.
6. The IAP and Firebase email identities must match before role, MFA, and recent-auth gates run.

The IAP assertion header is not trusted by itself. Only a successful cryptographic JWT verification
for the configured audience produces a `VerifiedIapPrincipal`.

## Human provisioning steps

After security review and during the deployment tranche:

1. Create the serverless NEG, external HTTPS load balancer, and backend service for
   `black-book-admin`.
2. Set Cloud Run ingress to `internal-and-cloud-load-balancing`; remove `allUsers` and
   `allAuthenticatedUsers` invoker grants.
3. Enable IAP on the backend service.
4. Grant `roles/iap.httpsResourceAccessor` only to the administrator access group represented by
   `${ADMIN_IAP_ACCESS_GROUP}`.
5. Record the backend service numeric id and configure the exact IAP audience shown in the policy.
6. Configure the application IAP verifier with Google public keys and expected issuer/audience.
7. Confirm denied group members cannot reach Cloud Run, then confirm allowed members still fail
   until Firebase MFA and app authorization also pass.

Do not place OAuth client secrets, Firebase tokens, MFA recovery codes, or bypass values in this
directory. If IAP requires a client credential for the selected load-balancer configuration, store
it in Secret Manager and grant only the deployment identity access.

## Local validation

```bash
node --test infra/gcp/iap/admin-iap-policy.test.mjs
```
