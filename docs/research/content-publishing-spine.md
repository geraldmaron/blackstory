# Content publishing spine

**Status:** shipped (theme-impact packets); pattern for future authored content
(articles, additional theme surfaces).

## Decision

The database is the source of truth for authored content; code owns the schema,
the validation gates, and the structural registries. Concretely:

1. **Authoring** lives in `bb_reference.theme_impact_packets` with the
   `draft -> review -> published` lifecycle. Fixture modules under
   `packages/ops-data/fixtures/theme-impact/` are authoring inputs and lineage,
   not runtime data; nothing imports them at runtime.
2. **Publishing** is a promotion + projection step run by
   `packages/ops-data/scripts/theme-packets.ts`:
   - `validate <fixture...>`: parse fixtures (bb_reference row shape) through
     the domain parser; run full publish gates on anything declared published.
   - `apply <fixture...>`: upsert at the declared status. Every cited
     observation must match `bb_reference.statistical_observations` (or
     `spine_observations_v` for `spine:` refs) verbatim, at every status.
     Nothing enters the authoring table with an unverifiable number.
   - `promote <id...>`: run `assertThemeImpactPacketPublishable` and the
     multi-decade checklist gate, then flip to published.
   - `project`: freeze all published packets into
     `bb_public.release_theme_impact_packets` for the active release, with a
     content hash per row.
   - `audit`: drift report between the active release projection and the
     authoring table (`published_not_projected`, `drifted_since_projection`,
     `in_release_only`).
3. **Serving** reads only the release projection. RLS exposes rows for the
   active release to anon; rollback is switching the `active_release` pointer,
   matching stories and entities. The web read path
   (`apps/web/src/lib/theme-impact/postgres-readers.ts` + `source.ts`) returns
   an explicit `unavailable` source on failure and pages render a friendly
   degraded state. There is no checked-in content fallback: stale substitute
   content is worse than an honest outage notice.
4. **The theme catalog stays in code**
   (`apps/web/src/lib/theme-impact/catalog.ts`). Theme ids are structurally
   coupled to the domain enum, the question registry, and routes; a catalog
   table would be a second source of truth, not a decoupling. Availability is
   derived at request time: a theme is available when the active release
   carries at least one packet for it.

## What this replaced

- `RESEARCHED_THEME_IMPACT_PACKETS` in `@repo/domain` as the compile-time
  content store (moved to
  `packages/ops-data/fixtures/theme-impact/researched-packets.ts` as authoring
  lineage; content tests moved with it).
- The published-only `apply-theme-impact-packets.ts` script, which had no path
  for review-status packets.
- The web fixture registry (`components/theme-impact/fixtures/`) and the
  silent live-with-fixture merge in `source.ts`.

## Line to hold for future content

Move content to the database when it is authored (packet bodies, story bodies,
article bodies). Keep it in code when it is structural (ids and enums, question
registries, catalogs coupled to routes and components). If themes ever become
fully dynamic (generic routes, per-theme questions in data), a catalog table
becomes a deliberate migration at that point, not before.

## Cross-references

| Concern | Where |
|---|---|
| Packet contract, publish gates | `packages/domain/src/statistics/theme-impact-packet.ts` |
| Projection envelope schema | `packages/schemas/src/public-projections.ts` |
| Lifecycle CLI | `packages/ops-data/scripts/theme-packets.ts` |
| Release tables + RLS | `supabase/migrations/20260726120000_content_publishing_spine.sql` |
| Packet system field tables | `docs/research/theme-impact-packet-system.md` |
| Prose voice for flagship packets | `docs/content/era-immersion-style.md` |
