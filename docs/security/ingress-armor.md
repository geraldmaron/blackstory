# Ingress boundary

**Status:** The product uses Vercel for the web deployment and the public API function,
Cloudflare in front of the public web property, and Supabase for Auth, Postgres, and Storage.
There is no GCP ingress. The Cloud Armor and load-balancer design stubs that used to live in
`infra/gcp/` were removed on 2026-11-25; git history has them if a GCP deployment is ever approved.

## Current boundary

- apps/web and /admin run in the shared Vercel web deployment.
- apps/api-public has a Vercel function entry point in apps/api-public/vercel.json.
- Public intake (corrections, appeals, abuse reports, leads) runs as apps/web routes and writes to
  quarantine only. The phone app hands corrections to the web form.
- Admin authorization is Supabase Auth plus trusted app_metadata.app_role; IAP and Firebase are
  not current admin controls. MFA and recent reauthentication are not enforced.
- Application rate-limit evaluators exist in @repo/security and API packages, but the shared
  distributed store and live middleware wiring remain follow-on work. See rate-limits.md.

## Threats and remaining checks

- T-01: volumetric and application-layer denial of service.
- T-02: expensive reads and cache bypass.
- T-19: scraping and corpus extraction.

The repository tests policy shape and fail-closed capability decisions. It does not prove live
Cloudflare, Vercel, or Supabase configuration. Provider dashboards, deployment logs,
and a bounded staging test are required for that claim.

## Related

- Service surfaces: service-surfaces.md
- Abuse cases: abuse-cases.md
- Cost and resource exhaustion controls: cost-resource-controls.md
