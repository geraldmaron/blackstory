# Database compromise

Preserve database audit records, affected table/key ranges, actor identities and the earliest
confirmed compromise time. Do not copy sensitive rows into incident messages.

1. Pause publication and affected research/intake writers with the supported kill switches.
2. Revoke compromised database credentials and Supabase sessions; rotate reachable secrets.
3. Inspect schema grants, RLS policies, role memberships and privileged functions for changes.
4. Keep a verified release artifact available if the database must be isolated. Confirm its
   actual availability before relying on degraded mode.
5. Restore a verified backup into a separate database using [recovery](../backup-restore.md).
   Compare row counts, hashes, release manifests, authorization and storage references.
6. Repair unauthorized changes, canary read-only access, then restore writes deliberately.

A credential rotation does not repair corrupted records. A schema reset does not prove recovery.
