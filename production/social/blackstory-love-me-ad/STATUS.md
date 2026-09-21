# STATUS

**Production complete.**

## Final files
| File | Purpose |
|---|---|
| `renders/blackstory-love-me-tiktok-v1.mp4` | **Upload file.** Silent track. Attach the AMBNT "Love Me" sound in TikTok at offset 0. |
| `renders/blackstory-love-me-tiktok-v1-synccheck.mp4` | Same cut with the reference audio. For review only, not for distribution. |
| `renders/blackstory-love-me-v002.mp4` | Master (near-all-intra mezzanine, ~60 Mb/s) that the above are encoded from |
| `renders/cover-frame-0720.png` | Recommended TikTok cover: the DC pin field over the Potomac, held in the 11.6s silence |

Earlier iteration kept: `v001` (rough cut).

## Current source project
`project/shots.mjs` (edit, as capture specs) → `capture.mjs` → `build-edit.mjs v002`
→ `scripts/deliver.sh`. Timing: `audio/markers.json`. Timeline: `EDIT-TIMELINE.md` (generated).

## Unresolved
- A real-time watch of the sync-check file by a person. The review was frame-sampled plus metrics.
- Large media is gitignored and lives only in this directory (~2 GB). Back it up if it matters.

## Blockers
None.

## Next action (if revising)
Change `in`/`out` or a `step` in `project/shots.mjs`, recapture only that shot
(`node capture.mjs <name>`), then `node build-edit.mjs v003` and `scripts/deliver.sh`.
