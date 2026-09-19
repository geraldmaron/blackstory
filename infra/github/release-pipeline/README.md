# Release pipeline helpers

Public web and staff administration deploy together from `apps/web` through Vercel Git
integration. Merging to the configured production branch is a release action. Manual GitHub
Actions record provenance and run the configured gates; their presence does not prove a live
cloud deployment. See [production release](../../../docs/runbooks/production-release.md).

The helpers validate deployment provenance, generate changelogs, check explicit workflow
controls, and rehearse application rollback without writes. `rollback-dry-run.sh` is a plan,
not database recovery evidence. Use [backup and recovery](../../../docs/runbooks/backup-restore.md)
for that separate requirement.

`infra/github/release-metadata/deployment-provenance.schema.json` owns provenance shape.
Optional API hosting requires its own provisioned identity and verified configuration. This
repository does not provision a WIF trust pool or a second public-web host.
