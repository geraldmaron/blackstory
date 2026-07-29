# Entity count: metric definition

<!-- canonical-count: 4092 as-of 2026-07-29 -->

## Single source of truth

`bb_canonical.entities` (Supabase project `blackstory-app`) is the **only** source of truth
for "how many entities does the project have." Nothing else counts:

- **`bb_public.release_entities`** is a derived publication projection, not an independent
  count. `packages/ops-data/scripts/publish-release-entities-incremental.ts` writes
  canonical → release, never the reverse. A release row count is not an entity count — it's
  releases × entities-per-release (e.g. 2749 rows was 2 releases × ~1382 canonical entities
  at the time, not 2749 distinct entities).
- **Firestore** is retired. See `docs/data/firebase-wind-down.md` and ADR-020.
  `packages/firebase/fixtures/national-catalog` is empty.

## Current value

Live canonical count as of 2026-07-29: **4092** (measured via `select count(*) from
bb_canonical.entities`).

History: 1395 (2026-07-27 baseline) → 1493 → 1540 → 3128 → 4085 → 4092 (2026-07-29), driven
by the [entity growth epic](../../.beads/) (`repo-jy6k`, target 1674, exceeded).

## Drift guard

Any doc that cites a hardcoded canonical count should embed a machine-readable marker:

```
<!-- canonical-count: <N> as-of <date> -->
```

Run the check before trusting a doc's number, or in CI:

```bash
set -a && source apps/web/.env.local && set +a
export DATABASE_SSL=1
node --conditions development --import tsx \
  packages/ops-data/scripts/check-canonical-count-drift.ts
```

The script (`packages/ops-data/scripts/check-canonical-count-drift.ts`) queries live
`bb_canonical.entities` and fails (exit 1) if a tracked doc's marker disagrees. Add new docs
to the `TRACKED_DOCS` list in that script if they need to assert a live-accurate count.

**Why this exists:** `docs/research/corsair-pending-inventory.md` cited a hardcoded canonical
count of 666, generated 2026-07-21, that went stale by 2x+ while every "pending" figure in
that doc was diffed against it — the same failure class as the BJS data-integrity incident
(plausible-looking numbers computed against a baseline nobody re-checked). See `repo-wa5j`.
