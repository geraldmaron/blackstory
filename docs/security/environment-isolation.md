# Environment and workload isolation

Supabase Postgres, Auth and Storage hold application state. Vercel hosts the web application
and its staff-gated admin routes. See [architecture](../architecture.md) for authority and
[data model](../data/postgres-schema.md) for schema boundaries.

## Credentials and execution

Public readers use credentials scoped to released projections. Admin writes are confined to
`apps/web/src/admin/`; `canonical-write-boundary.test.ts` checks imports across that boundary.
A shared web process does not provide process isolation between public and admin code. Keep
write credentials out of public environment variables, client bundles, logs and public loaders.
A separate admin deployment is the alternative if credential isolation cannot be maintained.

Authorization uses verified Supabase sessions and `app_metadata.app_role`, never editable user
metadata. API posture and permitted operations are defined in `packages/config/src/surfaces.ts`.
Research acquisition runs under the `research_worker` role with no publication or canonical
approval grants. Provision login credentials outside migrations and audit inherited privileges.

Local tests use isolated loopback databases and disposable users. Staging credentials must not
point at production. Verify resolved endpoints before a mutation without printing secrets.

## Deployment evidence

Repository files describe intended controls, not installed infrastructure. Verify actual host
configuration, RLS, grants, exposed schemas, object-bucket policies and deployment identities at
cutover. No additional cloud project, scheduled task or compatibility store is required by this
architecture. Never install a schedule as a side effect of development or migration.

A schema/client cutover requires a verified backup, isolated restore, denial tests, public-read
checks and a coordinated deployment. Follow [release](../runbooks/production-release.md) and
[recovery](../runbooks/backup-restore.md). Historical provisioning designs live in Git history.
