# Production release

Public web and staff administration share the `apps/web` Vercel deployment. Merging to the
configured production branch (`main`) can immediately deploy and move traffic through Vercel
Git integration. There is no additional manual promote step in the repository's release path.
A feature PR into `staging` is separate from the deliberate `staging` → `main` release PR.

## Before release

1. Review the complete diff and current [architecture](../architecture.md). Confirm the branch,
   tested commit and database migration history. Do not interpret old ADRs or simulated reports
   as release approval.
2. Run `fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging` on the final tree.
   Include the actual SQL migration chain and public/admin surfaces for a database change.
   Minimize pushes and PRs; local checks are the first feedback loop.
3. Verify recovery evidence using [backup and recovery](./backup-restore.md). A schema reset
   proves migration mechanics only. Preserve an independent data and object recovery point.
4. For an incompatible schema change, rehearse it against representative data, compare row
   counts/constraints/indexes, test denied operations, and coordinate clients and database as one
   cutover. Do not deploy clients that expect renamed schemas before the database is ready.
5. Verify the Vercel Preview, public source pointers, staff login and credential separation.
   `DATABASE_URL` is the public reader configuration; `ADMIN_DATABASE_URL` carries staff write
   access. Secrets must not enter bundles or logs.
6. Open the consolidated release PR only when its exact changes are intended for production.
   Record observed checks and unresolved risks in the PR. Merge is the release action.

## Verify the release

Verify the deployed commit using Vercel deployment metadata, then exercise public records,
source links and staff authorization. Check the configured public API independently when it
is hosted separately. `x-vercel-id` identifies a deployment request, not by itself a git SHA.

The manual `deploy-staging.yml`, `deploy-production.yml` and `progressive-release.yml` workflows
accept a tested commit SHA and explicit confirmation inputs. Read the selected workflow before
dispatch. Some steps are dry-run plans; an Actions success is not evidence that infrastructure
was provisioned or production traffic moved. Optional GCP authentication requires an already
provisioned OIDC identity. No retired cloud trust scaffolding should be recreated for research.

## Rollback

Stop affected publication or mutation paths using the [incident response](./incident-response.md)
controls. Revert or redeploy the last verified Vercel application only when it remains compatible
with the current database. Application rollback does not undo data writes or schema changes.
Use an isolated verified restore and coordinated cutover for incompatible data recovery.

Keep recovery evidence, sanitized execution logs, deployed commit and migration version together.
Do not automatically retry publication, restore, archive submission or deployment after an
uncertain outcome; inspect the resulting state first.
