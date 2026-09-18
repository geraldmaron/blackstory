# Vercel web deployment

The public site and staff workbench run in `apps/web` on Vercel. Supabase provides Postgres,
Auth and object storage. [The web surface contract](../../apps/web/SURFACE.md) defines the boundary.

## Prepare

1. Use the linked Vercel project with Root Directory `apps/web`. Inspect its current production
   branch, deployment protection, domains and environment targets. Repository files cannot prove
   the current account configuration.
2. Run the applicable local CI lanes before pushing. Use one consolidated PR for a coherent
   change; avoid repeated remote CI and deployment attempts as a debugging loop.
3. Configure the keys described by `apps/web/.env.example`. Public reads use `DATABASE_URL`;
   staff writes use the separate `ADMIN_DATABASE_URL`. Require encrypted database connections
   outside local development. Use the project's supported connection pooler and least-privilege roles.
4. Configure Supabase Auth's HTTPS origin and public client key for staff login. Keep service-role
   credentials server-only. Staff JWT authorization uses `app_metadata.app_role`.
5. Configure `APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL` for release artifacts and
   `SUBMISSION_PRIVACY_PEPPER` for submission hashing. Read secrets through approved local mounts
   or provider configuration; never print values or put them in command arguments.

## Verify a preview

Exercise the homepage, records, map, a record with citations, a missing record, staff login and
an unauthorized staff request against the intended database. Check both themes, console/network
failures, security headers and source links. An HTTP 200 alone is not a catalog health check.
For pooler or artifact failures, inspect runtime logs and the actual response before changing DNS.

Deployment-protection redirects must preserve Vercel's `_vercel_*` handshake parameters without
using tokens in shared cache keys. Do not redirect solely to alphabetize query parameters.

Environment changes require a new deployment. Preview and production need separate environment
values and should not share a writable production credential for verification.

## Release and recovery

Treat merging to the configured production branch as a release: Vercel's Git integration can
build and activate it automatically. For incompatible schema changes, verify deployed migration
history, isolated restore evidence, client compatibility and the maintenance procedure first.
See [production release](production-release.md) and [database restore](backup-restore.md).

Promote a known-good Vercel deployment only when it matches the database schema. Rolling back
application code alone after a schema cutover is unsafe. Preserve logs and the release identity;
use the coordinated database recovery procedure when the stored schema must also roll back.

## Cost observation

Measure artifact size, cache hit rate, origin egress, serverless compute and database query load.
Supabase pooler traffic and Storage CDN hits still contribute to their respective egress meters.
Vercel browser analytics sees clients that execute its script; it is not a complete crawler count.
