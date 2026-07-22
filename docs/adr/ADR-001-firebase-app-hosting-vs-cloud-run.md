# ADR-001: Public web host versus Cloud Run services

- **Status:** Accepted (amended by [ADR-027](./ADR-027-vercel-public-web-hosting.md))
- **Date:** 2026-07-16
- **Amended:** 2026-07-22
- **Depends on:** ADR-005

Filename kept for link stability (`…firebase-app-hosting…`). The decision is host
separation, not App Hosting as the live public target.

## Scaffold vs target

| Aspect | Today (verified) | Target |
|--------|------------------|--------|
| `apps/web` | Next.js on **Vercel** (`blackstory.app`) | Vercel (ADR-027) |
| App Hosting (`apps/web`) | **Retired in-repo**; owner deletes `black-book-web-*` backends | None |
| `apps/admin` | App Hosting (`black-book-admin-production`) until Cloud Run + IAP | Cloud Run + IAP |
| `apps/api-*` | Cloud Run (or local) | Separate Cloud Run services |

## Context

BlackStory needs a public Next.js site that can degrade to released snapshots, plus APIs
and a private admin console that must not share public route handlers or credentials.
Public web hosting and privileged API/admin runtimes are different trust domains.

## Decision

1. **Public web (`apps/web`)** production host is **Vercel** (ADR-027). No App Hosting configs
   or rollback path for public web remain in-repo.
2. **Admin (`apps/admin`)** deploys on **App Hosting** (`apphosting.admin.yaml`, backend
   `black-book-admin-production`) as an interim host until **Cloud Run + IAP** cutover. All
   **API surfaces** (`api-public`, `api-submissions`, `api-internal`) deploy on **Cloud Run**.
   Same trust isolation rules apply regardless of admin host.
3. Automatic uncontrolled rollouts are **disabled**; GitHub Actions / explicit promote
   control production traffic for Cloud Run and admin App Hosting (ADR-006). Public web uses
   Vercel explicit Production promote (ADR-027).
4. Public page rendering does **not** open database connections or invoke models; it
   reads released projections/snapshots via the public API, PostgREST published views
   (ADR-026), or static release artifacts (ADR-004).

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| All Next.js apps on one App Hosting backend | Admin must sit behind IAP and distinct credentials |
| All surfaces on Cloud Run only | Acceptable for APIs/admin; public web chose Vercel for Next delivery (ADR-027) |
| Single Cloud Run service for web + APIs | Collapses security domains |
| Separate microservice per page/feature | Over-decomposition beyond ADR-005 surfaces |

## Consequences

- Distinct deploy pipelines and service accounts for web vs APIs vs admin.
- Public web can remain readable in degraded mode from release snapshots even when APIs throttle.
- Operators manage Vercel (public web), Cloud Run (APIs), and interim App Hosting (admin only).

## Migration triggers

- Owner deletes `black-book-web-*` App Hosting backends after confirming Vercel stability
  (`docs/data/firebase-wind-down.md`).
- Admin moves from App Hosting to Cloud Run + IAP when cutover is approved (must still map to
  ADR-005 surfaces).
- Split or merge Cloud Run services only when a security boundary change is approved.

## Rollback considerations

- Keep `apps/web` buildable as a standard Next.js app so it can temporarily run on
  Cloud Run if Vercel is unavailable.
- Do not roll back by combining API and admin into the public web process; rollback is
  host change, not boundary collapse.
- Public web rollback is Vercel promote/redeploy of a prior SHA (ADR-027), not App Hosting.
