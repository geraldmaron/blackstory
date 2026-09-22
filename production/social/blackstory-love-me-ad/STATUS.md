# STATUS

**Production complete — v007 (revision 5) is current.**

## Final files
| File | Purpose |
|---|---|
| `renders/blackstory-love-me-tiktok-v5.mp4` | **Upload file.** Silent track; attach the AMBNT "Love Me" sound in TikTok at 0:00. see renders/, 1080×1920, 59.94fps |
| `renders/blackstory-love-me-tiktok-v5-synccheck.mp4` | Same cut with the reference audio, for review only |
| `renders/blackstory-love-me-v007.mp4` | Near-all-intra master |
| `renders/cover-v4-tubman-0100.png` | Recommended cover: Harriet Tubman, Dorchester County, Maryland, 1822 (frame 100 — unaffected by v007, still current) |

Superseded: v006 / tiktok-v4 (closing card was retyped text with no symbol —
off-brand per the kit's own guide; frames 0–3061 identical to v007, see D23).
v005 / tiktok-v3 (Memorial 14.1s; captions not yet reviewed; clustered final
map). v004 / tiktok-v2 (cuts 5-16 frames late on the bass; Memorial overlay;
missing summaries). v001 (rough), v002 / tiktok-v1 (screen-recording cut the
client rejected as map-heavy and repetitive). v003 was rebuilt as v004 after QA
and not kept.

## Source project (v007)
`project/edit-v3.mjs` (timeline) → `render-v3.mjs` (motion cards + new captures)
→ `build-v3.mjs v007` → `scripts/deliver.sh`. Card template: `assets/card.html`.
Closing card: `assets/brand-card.html` (D23 — now the kit's own lockup PNG, not
retyped text). Image provenance: `assets/media/PROVENANCE.md`.

## Unresolved
- A person should watch the sync-check file once in real time (carried over
  from v006; still true for the whole cut, now also covers the new closing card).
- Captures and media are gitignored and live only in this directory.
- `project/write-docs.mjs` generates `EDIT-TIMELINE.md` / `CAPTURE-MANIFEST.md`
  from `SHOTS` in `shots.mjs`, but the shipped edit is `TIMELINE` in
  `edit-v3.mjs` — the two have drifted (e.g. `shots.mjs` carries a `map-reveal`
  shot the real timeline doesn't use). Running it now produces a doc that
  disagrees with the actual video. Filed as repo-6hpnc; both docs
  were left at their last-known-accurate (pre-v007) content rather than
  regenerated. Needs a human to reconcile the two files before that generator
  is trusted again.

## Next action if revising
Edit a card in `project/edit-v3.mjs`, then `node render-v3.mjs <name>`,
`node build-v3.mjs v008`, deliver. For the closing card specifically:
`assets/brand-card.html`, then `node capture.mjs brand-fg` before the build step
(card is a still composite, not part of `edit-v3.mjs`'s per-frame cards).

Caption review: `RINGER-REVIEW.md` (verdict fix-then-ship; all correction-forcing
findings fixed in v006, carried unchanged into v007).
