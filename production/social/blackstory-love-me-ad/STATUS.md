# STATUS

**Production complete — v006 (revision 4) is current.**

## Final files
| File | Purpose |
|---|---|
| `renders/blackstory-love-me-tiktok-v4.mp4` | **Upload file.** Silent track; attach the AMBNT "Love Me" sound in TikTok at 0:00. see renders/, 1080×1920, 59.94fps |
| `renders/blackstory-love-me-tiktok-v4-synccheck.mp4` | Same cut with the reference audio, for review only |
| `renders/blackstory-love-me-v006.mp4` | Near-all-intra master |
| `renders/cover-v4-tubman-0100.png` | Recommended cover: Harriet Tubman, Dorchester County, Maryland, 1822 |

Superseded: v005 / tiktok-v3 (Memorial 14.1s; captions not yet reviewed; clustered final map). v004 / tiktok-v2 (cuts 5-16 frames late on the bass; Memorial overlay; missing summaries). v001 (rough), v002 / tiktok-v1 (screen-recording cut the client rejected
as map-heavy and repetitive). v003 was rebuilt as v004 after QA and not kept.

## Source project (v006)
`project/edit-v3.mjs` (timeline) → `render-v3.mjs` (motion cards + new captures)
→ `build-v3.mjs v006` → `scripts/deliver.sh`. Card template: `assets/card.html`.
Image provenance: `assets/media/PROVENANCE.md`.

## Unresolved
- A person should watch the sync-check file once in real time.
- Captures and media are gitignored and live only in this directory.

## Next action if revising
Edit a card in `project/edit-v3.mjs`, then `node render-v3.mjs <name>`, `node build-v3.mjs v006`, deliver.

Caption review: `RINGER-REVIEW.md` (verdict fix-then-ship; all correction-forcing findings fixed in v006).
