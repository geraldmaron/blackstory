# Backup and recovery

Supabase Postgres holds canonical records, evidence metadata, research state, permissions and
publication state. Supabase Storage holds source text and public media. A database backup alone
does not prove object recovery. Confirm the configured project's actual backup retention and
point-in-time recovery entitlement; neither is assumed by this repository.

## Isolated restore

1. Identify the backup, its source project, cutoff time, and required RPO/RTO before starting.
   Preserve it and its checksums. Use a destination separate from the source; never overwrite the
   system of record during a rehearsal. Do not copy production application secrets into it.
2. Restore the database using the supported Supabase recovery/export procedure for that backup.
   Record commands, tool versions, start/end times and failures in a sanitized execution log.
   Apply only the migrations needed to reach the intended application revision.
3. Compare table counts and stable content hashes against the backup baseline. Verify foreign
   keys, functions, RLS, staff role claims and denied anonymous/research-worker writes. An empty
   schema reset proves migration mechanics, not recovery of recorded history.
4. Restore or independently verify the required storage objects. Check their hashes, private
   access and public delivery paths against database references. Include source text and media.
5. Exercise public record/source delivery and authorized admin reads against the isolated restore.
   Verify release pointers and derived projections; record mismatches before rebuilding them.
6. Record measured recovery time and data loss. Resolve failures before declaring the drill passed.
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
