# Operator account protection

Protect the maintainer and the project's recovery capability without assuming paid services or
inventing provisioned infrastructure. Current application providers are listed in
[architecture](../architecture.md); check their live account configuration separately.

## Account custody

Use MFA on repository, hosting, database, DNS, store and payment accounts. Keep recovery codes
and backup authentication factors in controlled storage, separate from the primary device.
Use scoped service credentials and separate staff roles. Inventory owners and consumers before
revoking a key. Never put credentials or private account identifiers in public issues.

## Public identity and contact

Review domain registration privacy, public business contact details, account recovery addresses
and app-store disclosures. Use accurate required disclosures without exposing unnecessary personal
addresses or telephone numbers. Legal and tax arrangements depend on jurisdiction; obtain advice
for those decisions rather than treating repository notes as legal conclusions.

## Continuity

Keep independently recoverable database and object backups. Execute an isolated restore and verify
its results using [backup and recovery](backup-restore.md). A configured backup or alternate-host
plan is not proof of recovery. Do not assume a paid provider support tier or purchase one as part
of development. Record available support channels and account-export procedures.

For suspension, compromise or privacy incidents, use [incident response](incident-response.md)
and the relevant scenario runbook. Notifications require an operator decision; these documents do
not send messages or install monitoring schedules.

## Verification

Record which account controls and recovery paths were actually checked, by whom and when, without
secrets. Treat uninspected provider settings as unknown. Review changes when ownership, providers,
permissions or recovery requirements change. No recurring task is installed by this document.
