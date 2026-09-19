# Optional GCP ingress controls

**Status:** Optional design stubs only. No Cloud Armor policy, Cloud Run service, global load
balancer, or GCP ingress path is proven provisioned by this repository. The current product uses
Vercel for the web deployment and public API function deployment, Cloudflare in front of the
public web property, and Supabase for Auth, Postgres, and Storage. See
[infra/gcp/README.md](../../infra/gcp/README.md).

The files under infra/gcp/armor/ preserve a possible future deployment shape. They are useful for
policy review and tests, but their JSON, diagrams, and validation commands do not establish live
provider state.

## Current boundary

- apps/web and /admin run in the shared Vercel web deployment.
- apps/api-public has a Vercel function entry point in apps/api-public/vercel.json.
- apps/api-submissions has a quarantine-only capability contract. Its live provider and edge
  controls require separate verification.
- apps/api-internal accepts service identity in code. A private network or deployed service is not
  proven here.
- Admin authorization is Supabase Auth plus trusted app_metadata.app_role; IAP and Firebase are
  not current admin controls. MFA and recent reauthentication are not enforced.
- Application rate-limit evaluators exist in @repo/security and API packages, but the shared
  distributed store and live middleware wiring remain follow-on work. See rate-limits.md.

## Conditional future design

If a separate GCP deployment is explicitly approved and provisioned, the intended controls are:

1. Put public API services behind an external HTTPS load balancer and Cloud Armor.
2. Restrict direct service URLs and verify the restriction with a negative test.
3. Apply rate, WAF, and emergency-deny policies to public traffic.
4. Cache only safe immutable read responses at the edge. Never cache submissions or internal
   publication operations.
5. Record the applied provider state, service identity, ingress setting, policy revision, and
   rollback procedure before calling the design operational.

Until that work is verified, treat Cloud Armor and Cloud Run references as unproven controls. Do
not use the commands in the historical runbooks as incident instructions for the current
Vercel/Supabase deployment.

## Threats and remaining checks

- T-01: volumetric and application-layer denial of service.
- T-02: expensive reads and cache bypass.
- T-19: scraping and corpus extraction.

The repository tests policy shape and fail-closed capability decisions. It does not prove live
Cloudflare, Vercel, Supabase, or optional GCP configuration. Provider dashboards, deployment logs,
and a bounded staging test are required for that claim.

## Related

- Service surfaces: service-surfaces.md
- Abuse cases: abuse-cases.md
- Cost and resource exhaustion controls: cost-resource-controls.md
- Optional GCP Armor stubs: infra/gcp/armor/README.md
