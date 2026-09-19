# Schema validation

The migration chain and SQL tests define the expected schema. A passing local reset proves
reproducibility from an empty database; it does not prove a production upgrade or restoration.

1. Restore an actual backup into an isolated database and record source/destination identities.
2. Apply pending migrations with the matching application version. Record failures rather than
   removing conflicting rows or guessing task ownership.
3. Run `supabase/tests/research-kernel.sql` and the operator integration suite with
   `RESEARCH_TEST_DATABASE_URL` set to the isolated loopback database.
4. Verify counts, constraints, hashes, auth-role lookup, public release/search parity and storage
   references. Verify denied publication and canonical writes under the research worker role.
5. Inspect exposed schemas, RLS, routine execution grants and inherited role privileges.
6. Exercise public reads and staff authentication on the deployed application candidate.

The active-release singleton, evidence/source foreign keys, append-only claim versions and
`app_metadata.app_role` authorization remain required. Check them against actual SQL and runtime
outcomes. Store dated verification evidence in the audit record; do not treat an old PASS table
as current approval.

See [schema design](postgres-schema.md), [release](../runbooks/production-release.md) and
[recovery](../runbooks/backup-restore.md).
