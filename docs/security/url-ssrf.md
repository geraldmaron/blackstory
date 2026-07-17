# External URL safety and SSRF prevention (BB-030)

Submitted URLs are inert data during submission intake. The submissions service creates a
`url-evaluation` queue job and retains the source in quarantine; it does not resolve, connect to, or
parse the URL in the request path. Only the dedicated security URL-fetch worker may evaluate it.

## Fail-closed evaluation

Every initial URL and redirect target passes through the same sequence:

1. Parse with the platform URL parser. Permit only `http` and `https`, ports 80 and 443, no
   credentials, and no URL fragment. Apply the configured source-domain allow/deny policy to the
   canonical hostname.
2. Resolve all A and AAAA answers. Reject an empty result or any answer that is private, loopback,
   link-local, carrier-grade NAT, metadata, multicast, documentation, benchmark, or reserved.
   Encoded and IPv4-mapped address literals are classified by their canonical address.
3. Pin one approved address and connect directly to it. Preserve the validated hostname only for
   HTTP `Host` and TLS SNI. Reject the response if the connected peer differs from the pin. Never
   allow the HTTP library to perform a second, implicit DNS lookup.
4. Handle redirects manually. Automatic redirects are disabled. Reparse, re-resolve, reclassify,
   and repin every target, with at most four redirects.
5. Enforce one total ten-second deadline, a two-MiB response maximum (declared and streamed), and an
   explicit content-type allowlist (`text/html`, `text/plain`, `application/xhtml+xml`). Abort the
   transport when any limit is reached.
6. Parse bytes in a non-networked sandbox with no browser, JavaScript, external entities, file
   access, subprocesses, dynamic code, or archive expansion. Compute SHA-256 over the exact bounded
   response and record malware indicators before any downstream use.

DNS results are deliberately not cached across jobs or redirect hops. A production transport must
use a resolver/connect API that binds the validated answer to the socket. A conventional
`fetch(url)` call is not compliant because it can resolve again after policy evaluation.

## Quarantine lifecycle

The only allowed lifecycle is `queued -> fetching -> validating -> validated`, with rejection
possible before validation completes. `quarantineRequired`, `canonicalWriteAllowed: false`, and
`publicationAllowed: false` remain fixed in every state, including `validated`. Validation makes
content eligible for a separate moderation/publication decision; it never publishes content.

The queue contract includes `fetchDuringSubmissionRequest: false`. Intake code must not accept a
resolver, transport, or generic HTTP client. Fetched bytes and parser output belong in restricted
quarantine storage, not canonical Firestore collections, public projections, search indexes, or
model-training corpora.

## Source-domain policy

Domain rules match an exact canonical hostname or its subdomains. Deny rules take precedence over
allow rules. Maintain allowlists for integrations with stable source sets; otherwise use a reviewed
denylist in addition to IP classification. Domain approval never overrides destination-IP checks.
Internationalized names are evaluated after the runtime parser converts them to canonical ASCII.

Do not allow wildcard exceptions for organization-owned internal zones. At minimum deny metadata
hostnames and all private/internal DNS suffixes used by Black Book, Firebase, Google APIs, and
service discovery.

## Worker egress boundary

The worker requires a separate identity and network boundary from web, submissions, admin, research,
and publication services.

Allowed egress:

- DNS only through the approved validating resolver.
- TCP 80/443 only to the pinned public destination for the current job.
- The narrow queue-consumer and restricted quarantine-result write paths needed to receive work and
  return a result, preferably through authenticated service endpoints rather than broad Google API
  access.
- Logging and metrics through an approved telemetry path with URLs reduced to hostname and a keyed
  or one-way identifier; never log credentials, query strings, or response bodies.

Denied egress:

- RFC1918, loopback, link-local, carrier-grade NAT, multicast, reserved, and IPv6 ULA/link-local
  ranges.
- `169.254.169.254`, `metadata.google.internal`, and every cloud metadata alias.
- Production Firestore/Firebase data APIs, deferred Cloud SQL, Redis, admin endpoints, internal APIs,
  serverless VPC connector private ranges, and organization service-discovery zones.
- Arbitrary Google APIs and `*.googleapis.com` unless a later reviewed design introduces a
  dedicated, narrowly scoped result channel.

The runtime service account must have no production database role, no Firebase Admin capability,
no Secret Manager accessor role, and no token-creation or service-account impersonation role.
Application policy and IAM are defense in depth; the network boundary must independently deny these
destinations.

## Human GCP deployment steps

These are reviewed human steps; this repository does not apply live GCP or Firebase changes.

1. Create a dedicated Cloud Run worker service/job and service account for URL evaluation. Do not
   reuse any application, admin, or research identity.
2. Configure all worker egress through a dedicated VPC connector or direct-VPC subnet and a
   controlled NAT/proxy path. Use hierarchical firewall policy or the approved secure-web-proxy
   design to deny internal, metadata, Google API, and production service ranges before permitting
   public TCP 80/443. A plain Cloud NAT gateway alone is not a destination allow/deny control.
3. Add explicit deny logging and alerts for metadata, private ranges, production Firebase/Firestore,
   internal API addresses, and unexpected ports. Verify the deny has higher priority than broad
   egress permits.
4. Restrict ingress to the authenticated queue dispatcher. Grant only queue consumption and the
   minimum result-write capability. Verify the worker identity has no roles inherited through broad
   project-level groups.
5. Disable automatic redirect handling in the production transport; configure the approved DNS
   resolver and socket-level IP pinning. Set platform request/task deadlines no higher than the
   application limit.
6. Deploy to a non-production environment and run controlled canary tests against owned public and
   private fixtures. Confirm firewall logs show denied attempts to metadata, Firestore/Google APIs,
   internal APIs, loopback, private IPv4, ULA IPv6, and link-local IPv6.
7. Have security review the effective IAM policy, firewall priorities, routes, DNS policy, VPC
   connector, and NAT/proxy configuration before production rollout.

## Verification

Unit tests use injected DNS and transport fixtures only; they never contact live systems.

```bash
pnpm --filter @black-book/security test
pnpm --filter @black-book/security typecheck
node --conditions development --import tsx --test \
  packages/security/src/url-safety/url-safety.test.ts
cd workers/security
python -m pytest src/black_book_security/url_fetch -q
```
