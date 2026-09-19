# Entity count: metric definition

## Single source of truth

`canonical.entities` (Supabase project `blackstory-app`) is the **only** source of truth
for "how many entities does the project have." Nothing else counts:

- **`published.release_entities`** is a derived publication projection, not an independent
  count. `packages/ops-data/scripts/publish-release-entities-incremental.ts` writes
  canonical → release, never the reverse. A release row count is not an entity count — it's
  releases × entities-per-release (e.g. 2749 rows was 2 releases × ~1382 canonical entities
  at the time, not 2749 distinct entities).
- **Firestore** is retired. See [the engineering contract](../decisions-carryover.md#data-and-publication).

## Measuring the value

Run `SELECT count(*) FROM canonical.entities` in a read-only transaction for a current
measurement. The [research audit](../research/framework-audit.md) records a dated observation;
that observation is not a live count. Do not compare pending intake against a cached number.

## Avoiding drift

Do not hardcode a live catalog count in maintained operating documentation. Query the canonical
table when a decision needs the current value. Audit records should state their query, timestamp,
and scope; historical observations remain historical instead of failing as the catalog grows.
