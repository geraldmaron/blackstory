# QA — final review

Reviewed render: `renders/blackstory-love-me-v002.mp4` (master) and its delivery
encodes `renders/blackstory-love-me-tiktok-v1.mp4` / `-synccheck.mp4`.
Programmatic results: `renders/blackstory-love-me-v002-qa.json` (from `scripts/qa_render.py`).

Two review passes were made: pass 1 (visual) on v001, which produced the v002
fine cut; pass 2 (visual + sync) on v002. What was checked by machine and what
was checked by looking is stated per line.

## Visual QA

| Check | Result | How verified |
|---|---|---|
| No blank frames | **Pass** — 0 of 3264 near-uniform frames | `qa_render.py` (frame std < 0.012) |
| No loading states / empty image boxes | **Pass** | image gate refuses to render a shot until its image has pixels; blank-frame scan |
| No cursor | **Pass** | captures are screenshots of a headless page; no pointer exists |
| No map tile failures | **Pass** | per-frame wait on `areTilesLoaded()`; mid-shot samples of all 13 map shots inspected |
| No warped UI / bad crops | **Pass after fix** | v001 cropped the Tulsa chapter title; v002 reframed and inspected |
| TikTok safe areas | **Pass** | lockup centred at y≈850–1100 of 1920; clear of bottom ~420px caption zone and right ~260px action rail. OSM attribution sits bottom-left inside the caption zone — deliberate, see D12 |
| No low-resolution media | **Pass** | captured at 2160×3840, lanczos to 1080×1920; historical images served at 924–2000px wide |
| No stuttering motion | **Pass** | deterministic per-frame camera; no real-time capture anywhere |
| No browser chrome / dev tooling | **Pass** | headless, Next dev badge suppressed; spot-checked every shot |
| No scrollbars | **Pass** | hidden by CSS and by transform-based movement |
| Site chrome | **Pass after fix** | v001 showed the site nav (with the BlackStory wordmark) and a footer. Removed in v002 — see D9 |
| Transitions | **Pass** | 23 hard cuts, 4 motion-matched joins, 1 five-frame dissolve (Memorial). See correction below |

**Correction found in pass 2.** The frame-difference check showed that at frames
206, 384, 567 and 3074 the incoming shot's first frame equals the outgoing shot's
last frame. Those are not hard cuts, as v001's EDL stated. They are
motion-matched joins where the camera launches on the hit. Kept (see D10), and
the EDL generator was corrected.

## Audio QA

| Check | Result | How verified |
|---|---|---|
| Correct reference audio | **Pass** | demuxed from the file whose ID was verified via TikTok oEmbed (SOURCES.md) |
| Correct start point | **Pass** | audio sample 0 = video frame 0; audio begins 0.0247s; no offset applied |
| No clipping | **Pass** | true peak −2.4 dBFS (EBU R128) on the sync-check copy |
| Loudness | **Pass** | −12.5 LUFS integrated, LRA 2.5 LU. Reference level unaltered. |
| Cuts aligned to markers | **Pass** | every one of 28 cut/join frames lands on its measured marker frame (offset 0) |
| Clean ending | **Pass** | final decay runs to silence at 54.381s; lockup holds still from ~52.1s |
| No unintended silent gaps | **Pass** | the only silences are the track's own engineered GAPs |
| Phase / channels | **Pass** | stereo 48k, taken straight from source; no processing |
| Upload master silent | **By design** | max volume −91 dB; sound attached in TikTok (D3) |

## Content QA

| Check | Result |
|---|---|
| Branding | **Pass** — "BlackStory." in Schibsted Grotesk 600 with the accent full stop, as the product sets it |
| URL | **Pass** — `blackstory.app` |
| Tagline exactly "History, pinned to place." | **Pass** — "place" set in Newsreader italic, matching the product's accent style |
| Historical media from intended records | **Pass** — Tulsa postcard (`/stories/the-gap-that-never-closed`), Du Bois plate (`/lives`), LBJ / Voting Rights Act photo (`/stories/the-count`); all served by BlackStory itself |
| No invented claims | **Pass** — no editorial copy other than the lockup |
| Memorial handled respectfully | **Pass** — 14.1s, two slow shots, no push beyond 7.5%, joined by a dissolve, no effects |
| No misleading representation | **Pass** — presidential portraits excluded because out of context they would misread (README §10) |
| No untracked third-party assets | **Pass** — only BlackStory-served media and the reference audio |

## Export QA

| Check | Result |
|---|---|
| 9:16, 1080×1920 | **Pass** |
| Frame rate | **Pass** — 59.94 (60000/1001), matching the reference |
| H.264 / AAC | **Pass** — High@5.1, yuv420p, BT.709 tagged; AAC-LC 48k stereo |
| No watermark | **Pass** |
| Plays start to end | **Pass** — full decode with no errors |
| Duration | **Pass** — 54.454s = 3264 frames; audio 54.452s (2.4ms short, padded) |
| A/V sync throughout | **Pass** — frame-locked by construction; audio unedited |
| File size | **Pass after fix** — first final was a 60 Mb/s / 411 MB all-intra mezzanine. Re-encoded to 16.5 Mb/s / 112 MB, SSIM 0.996 vs master |

## Defects found and fixed

| # | Defect | Fix |
|---|---|---|
| 1 | Dred Scott portrait never paints (external host) | dropped; image gate added |
| 2 | LBJ capture refused (lazy image below the fold) | gate moved after the page sweep |
| 3 | Lockup capture EPIPE | QTRLE needs `.mov`, not `.mp4` |
| 4 | `/explore` renders a 3-pane dashboard | map shots moved to the full-bleed Door |
| 5 | Fast flurry used unreadable images | three city map punches plus a Tulsa match cut |
| 6 | Tulsa title cropped | reframed to the hero as designed |
| 7 | Evidence beat showed "coverage: minimal / not linked yet" | moved to The Count's primary-source reference list |
| 8 | Site nav/footer revealed the brand early | nav hidden on every shot, footers avoided |
| 9 | Lockup competing with the pin field | scrim in `--ds-surface-sunken` |
| 10 | Sync copy lost its last frame | `apad` before `-shortest` |
| 11 | EDL called four joins "hard cuts" | generator corrected |
| 12 | Final file 411 MB all-intra | delivery encode stage added |
| 13 | Dev server SIGTERM'd mid-capture (code 143, externally) | restarted; the 4 interrupted shots recaptured |

## Residual risk

- **Not reviewed in real time.** I can't watch playback, so I reviewed by frame
  sampling plus per-frame metrics. Motion judgement comes from the easing curves
  and mid-shot frames. A real-time watch of the sync-check file is the one review
  a human should still do.
- The three city punches read as city road webs in the product's single amber
  palette. They're distinct, but not dramatically so.
- The captures depend on the dev server and external image hosts. A recapture on
  another day can differ if the archive data changes.
