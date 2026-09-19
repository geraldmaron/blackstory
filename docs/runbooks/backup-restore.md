# Backup and recovery

Supabase Postgres holds canonical records, evidence metadata, research state, permissions and
publication state. Supabase Storage holds source text and public media. A database backup alone
does not prove object recovery. Confirm the configured project's actual backup retention and
point-in-time recovery entitlement; neither is assumed by this repository.

An application-schema dump is not a complete Supabase recovery set. A complete logical recovery
bundle includes application schemas, the `auth` and `storage` database schemas, migration history,
required roles and grants, a sanitized inventory of provider Auth configuration, recoverable
private and public objects with byte hashes, and the matching old application build identities.
Auth exports contain sensitive credential records, including password hashes and login tokens.
Keep the complete bundle in owner-only local storage, exclude it from Git and shared logs, and
use synthetic identities for checks that do not require original Auth records. Bind a local
recovery database to loopback with fresh credentials; an ordinary development container exposed
on every network interface is unsuitable for a sensitive Auth restore.
A provider physical clone may supply some database/Auth pieces, but its current documented scope
must be checked at drill time; Storage objects and provider settings require separate recovery.

## Isolated restore

1. Identify the backup, its source project, cutoff time, and proposed RPO/RTO before starting.
   Targets remain unmeasured until this complete restore finishes.
   Preserve it and its checksums. Use a destination separate from the source; never overwrite the
   system of record during a rehearsal. Do not copy production application secrets into it.
2. Restore either a provider-supported physical recovery point or the complete logical bundle.
   Record commands, tool versions, start/end times and failures in a sanitized execution log.
   A schema-filtered `pg_dump` does not supply every extension definition or provider-initialized
   extension grant. Inventory versions, owners, effective grants and membership in built-in `pg_*`
   roles explicitly. Install the prerequisites before restoring dependent objects, then compare
   restored permissions rather than inferring parity from a successful import.
   Record each service version and required role settings, including the Auth role's search path.
   Restore against the matching Auth service; a different image or missing `search_path=auth` can
   select the wrong migration table. Apply only migrations needed for the intended revision.
3. Compare table counts and stable content hashes against the backup baseline using the same
   serialization settings, including `extra_float_digits`, `TimeZone`, `DateStyle` and `bytea_output`.
   A formatting difference must not be mistaken for lost rows or corrected by editing data. Verify
   required roles and grants, foreign keys, functions, RLS, Auth users, staff role claims, migration history,
   Storage metadata and denied anonymous/research-worker writes. An empty schema reset or an
   application-only dump proves migration mechanics, not recovery of the complete system.
4. Restore or independently verify the required storage objects. Check their hashes, private
   access and public delivery paths against database references. Include source text and media.
5. Exercise public record/source delivery and authorized admin reads against the isolated restore.
   Verify release pointers and derived projections; record mismatches before rebuilding them.
6. Record measured recovery time and data loss. A paid provider clone is not required when a
   complete logical restore meets the approved targets and all checks above; it remains a valid
   alternative until that evidence exists. Resolve failures before declaring the drill passed.
   Keep the backup and evidence until the replacement recovery point is verified.

## Launch evidence contract

The launch evaluator reads `artifacts/recovery/latest.json`. This is operator-produced evidence
from an executed restore, never a checked-in passing fixture. It must contain:

- `schemaVersion: 1`, `mode: "executed"`, `database: "postgres"`.
- Nonempty `backupId`, `sourceId`, distinct `destinationId`, and `verifiedBy`.
- An actual ISO `completedAt` timestamp.
- Nonnegative measured `elapsedSeconds` and `dataLossSeconds`, plus approved `rtoSeconds`
  (positive) and `rpoSeconds`. Both measured values must meet their targets.
- `checks` with `rowCounts`, `contentHashes`, `authorization`, `publicProjection`, and
  `storageObjects`, each true only after verification.
- `logPath`, relative to the repository, and `logSha256` matching the sanitized execution log.

The evaluator checks structure, targets, required results and log integrity. It cannot establish
that an operator's statements are truthful. Review the log and actual restored surfaces. Missing
or simulated evidence blocks launch; passing unit tests do not supply operational evidence.

## Recovery during an incident

Contain publication and writes first using the [incident runbook](./incident-response.md).
Use an uncompromised administrator identity. Restore to an isolated destination, verify it, and
coordinate the database, auth, storage and application cutover. Keep the original recovery point
until the replacement is checked. Replaying only a deployment does not reverse data mutations.
