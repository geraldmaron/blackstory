# STATUS

**Production complete — v005 (revision 3) is current.**

## Final files
| File | Purpose |
|---|---|
| `renders/blackstory-love-me-tiktok-v3.mp4` | **Upload file.** Silent track; attach the AMBNT "Love Me" sound in TikTok at 0:00. 81 MB, 1080×1920, 59.94fps |
| `renders/blackstory-love-me-tiktok-v3-synccheck.mp4` | Same cut with the reference audio, for review only |
| `renders/blackstory-love-me-v005.mp4` | Near-all-intra master |
| `renders/cover-v3-tubman-0100.png` | Recommended cover: Harriet Tubman, Dorchester County, Maryland, 1822 |

Superseded: v004 / tiktok-v2 (cuts 5-16 frames late on the bass; Memorial overlay; missing summaries). v001 (rough), v002 / tiktok-v1 (screen-recording cut the client rejected
as map-heavy and repetitive). v003 was rebuilt as v004 after QA and not kept.

## Source project (v005)
`project/edit-v3.mjs` (timeline) → `render-v3.mjs` (motion cards + new captures)
→ `build-v3.mjs v005` → `scripts/deliver.sh`. Card template: `assets/card.html`.
Image provenance: `assets/media/PROVENANCE.md`.

## Unresolved
- A person should watch the sync-check file once in real time.
- Captures and media are gitignored and live only in this directory.

## Next action if revising
Edit a card in `project/edit-v3.mjs`, then `node render-v3.mjs <name>`, `node build-v3.mjs v005`, deliver.
