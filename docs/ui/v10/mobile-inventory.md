# v10 mobile inventory

**Status:** source-validated (2026-08-31).  
**Parent:** [`../design-direction-v10.md`](../design-direction-v10.md).  
**Audit:** [Mobile + filter inventory](4e28c3af-2658-413d-b1c4-b68e77073a8f).

## Tabs

| Tab | Route | Web peer | Disposition |
|---|---|---|---|
| Explore | `/explore` | Atlas `/explore` | Keep; sync DiscoveryState vocabulary |
| History | `/history` | Records `/records` (+ legacy history redirect) | Keep as find-in-time; expand facets toward Records |
| Stories | `/learn` | Stories `/stories` | Keep Stories label; optional `/stories` alias later |
| More | `/more` | Library `/library` | Keep as overflow; optional Library rename |
| Legacy Search | `/search` → `/history` | `/search` → `/records` | Keep deep-link redirect |

## Rest / Engaged

Mobile still uses cinematic Rest→Invite→Engaged (`cinematic-map-state.ts`). Web Door uses HTML pin plate + reading chrome; web Instrument is `/explore`. Do not shrink desktop Atlas panels onto mobile; keep bottom-sheet patterns.

## Terminology drift to close

| Concept | Web | Mobile | Unify toward |
|---|---|---|---|
| Map instrument | Atlas | Explore | Atlas (copy) |
| Entity index | Records | History | Records / find-in-time |
| Topic | `topic` / Explore `theme` | `theme` | DiscoveryState `topic` (URL alias `theme` on Explore) |
| Evidence | Records `evidence` → Explore `floor` | `confidence` only | Floor + separate exact tier |

## Filters

Mobile Explore mirrors Explore pin filters (kind, era, tone, theme, status, confidence, state). History search is primarily `q` + raw kind. Books/Law/Themes/Memorial use local filters.

## Themes native

Web `/themes` redirects to `/stories`. Mobile `/themes` still ships. Park or fold into Stories collections in P2.

## Shared with web (required)

- DiscoveryState semantics (not literal layouts)
- Evidence honesty / nearby ≠ related
- Memorial dignity (names list; no gamification)
- Public access without account
