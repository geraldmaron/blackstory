# Recovery rehearsal

Use the [backup and recovery procedure](./backup-restore.md) for executed Postgres and Storage
recovery. A schema reset or simulated timer does not qualify as a restore rehearsal.

Use the [production release procedure](./production-release.md) for application rollback and the
[incident response procedure](./incident-response.md) for containment. Application rollback and
database recovery are separate operations: verify their schema compatibility before redirecting
traffic. No rehearsal or recurring backup job is installed by this document.
