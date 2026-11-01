# Reconciliation disposition: candidate 7fb7f62a

Scope: the unique-file diffs in `.task-tools/recovered/` plus the current counterparts I checked with Grep. Read-only review. Nothing was merged, deleted, or run.

Count note: the inventory lists 16 unique file entries across 7 worktrees, not 17. `door-home.css` and `explore.css` appear in two worktrees, so there are 14 distinct paths. `agent-a0fc42a056068c98c` has 0 unique files and its diff is empty (17 of 17 sources are in candidate history).

## Per-worktree classification

| Worktree | Class | Reason |
|---|---|---|
| `blackstory-graph-guard` (`fix/release-graph-empty-edge-guard`, 3 files) | **Out-of-scope potential data-publication work; genuine gap, but not a UI candidate gap** | See finding 1. Candidate has none of it (0 of 3 in history). |
| `agent-a0fc42a0…` | Historically integrated | No unique content. Safe to archive/prune. |
| `agent-a7073ed8…` (map-controls.css, MapStage.tsx, atlas-pending.css) | Superseded | Old side is a regression against candidate (details below). |
| `agent-a8e2b596…` (story-packet-review-decision.ts) | Superseded | Old side is a shorter comment on the same type. Candidate's comment is more accurate. It is imported by 4 files, so the type is unchanged. |
| `agent-aca2a15d…` (door-home.css, explore.css) | Superseded | Old side predates the current Door and Explore work. |
| `agent-aef4f27e…` (door-home.css, explore.css) | Superseded | Same as above, plus side-stripe styling that conflicts with the brand rules. |
| `agent-af05ef15…` (admin-nav.ts) | Superseded | Candidate has `ADMIN_QUEUE` / `ADMIN_TOP_LEVEL`. |
| `agent-af994088…` (footprint ×4) | Superseded (formatting only plus one a11y regression) | See below. |

## Why the old hunks must not enter the UI candidate

- **`MapStage.tsx` ~L1873.** The old copy drops `if (posture === 'live') map.setMinZoom(Math.min(MAP_MIN_ZOOM, map.getZoom()))`. Candidate still has it at `MapStage.tsx:1880`, with a comment explaining the coast-crop bug it prevents. Taking the old side would bring that bug back.
- **`map-controls.css`.** The old copy removes the hide-on-open-sheet rule for compact screens (candidate L125/L143). `apps/web/src/app/map-controls-collision.test.ts:13` tests that selector, so merging the old side would break that test and bring back controls overlapping the collection strip. The old row layout is the only novel idea there, and it is cosmetic.
- **`atlas-pending.css`.** The old copy removes `overflow: hidden` (candidate L11). It is a one-line difference with no evidence it fixes anything.
- **`door-home.css` (both).**
  - Both delete the two-column opening, the search form, and the orientation column.
  - Both revert to `--ds-font-ui`, which the candidate moved away from.
  - Both add `box-shadow: var(--ds-contact-hairline)` and `var(--ds-contact-overlap)`. The AGENTS brand rules forbid shadows ("flat matte only").
  - The `aef4` copy also adds `border-left: 4px` accent stripes, and its `.ds-nc__kind-rule` change removes the dot treatment the candidate comment says replaced side stripes.
- **`explore.css` (both).** Both delete the "Map investigation rails" workbench block, which is current collection work. `aca2` shrinks a label to 0.625rem, below the 0.75rem micro-type used elsewhere. `aef4` reintroduces side stripes.
- **`admin-nav.ts`.** The old copy removes `ADMIN_TOP_LEVEL`. `admin-nav.test.ts`, `AdminShellChrome.tsx` (L16/74/114) and candidate `adminPaletteItems` all import it, so taking the old side would break compilation.
- **`footprint`.** The old `.ts` and `.test.ts` are Prettier-only differences. The old `page.tsx` moves the explanation into a visible `<caption>`. Candidate keeps it as the panel description with a visually hidden caption, so it is not cut off on phones. Candidate is correct and the old side regresses.

**Nothing from the UI-side old hunks needs to enter the candidate.**

## Findings

### 1. High impact, but outside the UI candidate: empty-graph publish guard is missing

- **Path:** `packages/ops-data/scripts/lib/release-graph-publish.ts` (hunks: `UNEVIDENCED_RELATIONSHIP_COUNT_SQL`, `LIVE_ALL_TIME_EDGE_COUNT_SQL`, `assertReleaseGraphNotEmptiedOrThrow`, and the call inside `rebuildReleaseGraphForRelease`). Also `rebuild-release-graph.ts` (`ALLOW_EMPTY_RELEASE_GRAPH`) and the matching tests.
- **Issue:** Per the old file's own comment, an empty rebuild passes every other audit check. A rebuild whose inputs all filter out (the comment cites 1,092 published edges lacking evidence rows) could replace a populated published graph with an empty one.
- **Exposure:** The script defaults to dry-run and requires `DRY_RUN=0 RELEASE_GRAPH_APPLY=1`, so the risk is only on an explicit apply. Candidate, which lacks the guard, contains no UI that depends on it.
- **Recommendation:** Do not merge it into this UI candidate. Keep branch `fix/release-graph-empty-edge-guard` and its diff, and open a separate data-lane review before any apply run. I did not verify the old SQL against the schema (no DB access). It is a guard function and cannot be treated as an approved data write.

No other high-impact issue found. The rest is cosmetic or already superseded.

## What must stay preserved

- Whole `blackstory-graph-guard` worktree, branch and `.unique.diff`. This is the only content with future value.
- The other `.unique.diff` files and root's full patch backups. The old files differ from candidate only by superseded work, but nothing should be deleted until root signs off.
- Do not delete branch history for anything.

## Consolidated recommendation

1. **No source change needed in the UI candidate 7fb7f62a.** No concrete gap was found there.
2. **Safe to archive/prune** (root decides; I performed nothing): `agent-a0fc42a0…` (patch-equivalent, empty diff). The three clean worker branches root named as patch-equivalent are not listed in this inventory, so I could not check them.
3. **Archive, then prune only the worktree directories** (keep branch refs and `.unique.diff` backups) for a7073, a8e2, aca2, aef4, af05, af99. Their unique hunks are stale regressions, but the backups are the audit trail.
4. **Keep in place:** `blackstory-graph-guard`.

## Real residual gates

- Root's signed-in staff acceptance and browser QA, which I did not run or review.
- Separate review of the graph-guard branch (SQL against the schema, tests run) before any release-graph apply.
- Root's canonical Git operations: archive tags and prune.
