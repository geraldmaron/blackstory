# WORKLOG

Chronological production log. Trivial command noise is omitted; the purpose is
to make the work reconstructable.

All entries 2026-09-20 unless noted.

---

**01 — Environment survey.**
ffmpeg/ffprobe 8.1.2, Node 24.19.0, Python 3.14.5 present. No yt-dlp, no
Playwright/Puppeteer in the repo. Chrome + an ms-playwright cache present on the
machine. Nothing listening on port 3048.
*Result:* viable. Installed yt-dlp (2026.08.19) into a scratch venv and
Playwright 1.49 + Chromium 1243 into `project/`.

**02 — Reference located and retrieved.**
Queried TikTok's oEmbed endpoint for the exact URL first: returned
`author_url=@ambnt.prod`, `data-video-id=7670347350115634462`, caption tagged
`#editaudio #loveme #jmsn`. Confirms the post identity before download.
`yt-dlp` then retrieved it **directly from TikTok — no mirror was required.**
*Result:* `reference/ambnt-7670347350115634462.mp4`, 2.14 MiB.
*Measured:* 54.4276s, HEVC 1080×1920, 59.94 fps, 3262 frames, AAC 44.1k stereo.
→ The brief's "approximately one minute" is wrong: the piece is **54.45s**.

**03 — Reference video analysed.** `scripts/analyze_reference_video.py`
Decoded to 64×114 grayscale and computed per-frame difference and luma.
*Result:* mean inter-frame motion 0.0017, luma flat 0.126–0.151, fade to black
from 52.44s. Zero cuts detected at any sane threshold.
*Follow-up:* extracted a 13-frame contact sheet to see why.

**04 — Material finding: the reference has no visual grammar.**
The contact sheet shows the reference is a **screen recording of a DAW
arrangement**, captioned *""Love Me" But It's Designed For Edits"*. @ambnt.prod
is a producer showcasing an edit-audio build, not an editor showing an edit.
Track lanes legible: HIGH CHORDS, SAW CHORDS, SAW LEAD, ARP, SUB, BASS, HIT,
HIT 1, WOOSH HIT, BOOM, F#, SUCKBACK, DOWNER, RISER.
*Consequence:* brief §2 (study the reference's cuts, whips, speed ramps) is
answered by measurement showing there are none. The reference is an **audio**
source; the DAW lanes become labelled ground truth for onset detection.
Recorded as DECISIONS.md §D1. PLAN.md revised (R1).

**05 — Audio analysed.** `scripts/analyze_audio.py` → `audio/analysis.json`
librosa 1.0.0, 48kHz mono, 256-sample hop. HPSS split, band energies, pYIN.
*Result:* audio starts 0.0247s, ends 54.381s.
*Defect found:* librosa's beat tracker returned 123.6 BPM. Cross-checking against
the measured 3.000s spacing of the engineered silences gives **80 BPM** — the
tracker was an octave out. Tempo demoted to metadata; not used for anything.

**06 — Marker map built.** `scripts/build_markers.py` → `audio/markers.json`
128-sample hop (2.67ms, finer than one video frame). Three detectors: GAP
(engineered silence), HIT (sub-band attack, backtracked to the attack foot), VOX
(merged vocal phrase with pYIN sustain length).
*Result:* 135 markers — 3 GAP, 110 HIT, 22 VOX. Key structure:
- GAPs at 5.637 / 8.613 / 11.595, each ~0.68s, spaced 2.98s
- VOX 28.051, 6.13s long with a **4.18s steady-pitch hold**, sub absent → Memorial
- HIT 42.184 strength 0.895, the strongest transient in the track → the drop
- final cadence 51.283 / 51.576 / 51.933 / 52.301, decaying to silence

**07 — Product inspected.** `project/inspect.mjs`
All 15 candidate routes returned HTTP 200 on blackstory.app. Map canvas confirmed
rendering headless at 2160×3840 (WebGL under `--use-angle=metal`).
*Noted:* Memorial's background is `rgb(248,244,236)` — the only light surface in
an otherwise `rgb(19,17,16)` product.

**08 — Map control found.** Probed blackstory.app for a MapLibre handle: none.
Read the source instead: `MapStage.tsx:1427` exposes the instance on
`window.__bpMapStage`, but only under `NODE_ENV !== 'production'`.
*Consequence:* captured from the local dev server. Verified on dev: `flyTo`,
`easeTo`, `jumpTo`, zoom 3–14, cluster/choropleth layers all present.
Recorded as DECISIONS.md §D4.

**09 — Content selected from live data.** `project/probe-content.mjs`
Queried rendered cluster features at national zoom. Densest: **Washington DC
1,192 records** at [-76.72, 38.69], then Georgia 903, Mississippi 359,
Oklahoma 331. Door reports 3,302 places / 4,282 in this release.
*Decision:* the descent lands on DC; O Street Market (7th & O NW) is the pin.

**10 — Page geometry mapped.** `project/probe-geometry.mjs`
Exact heading/image offsets for every page to be shot. Memorial's alphabetical
wall runs y=2412→21576 (A124 … Z1) as static text — deterministic to capture,
unlike the animated perspective wall above it.

**11 — Page camera built.** `project/page-cam.mjs`
Movement is a compositor transform (`scale(z) translate(-dx,-Y)`), not scrolling:
no reflow, no scroll jank, no lazy-load pop mid-shot, and text/images
re-rasterise at the transformed scale so a push-in stays sharp.
*Rejected:* scroll-based movement, and ffmpeg `zoompan` post-hoc — both worse.

**12 — QA failure: historical images do not reliably paint.**
The historical media is hotlinked from `upload.wikimedia.org` and `tile.loc.gov`.
Patient polling (90s) showed the Constitution image at 0×0 on one run and fully
loaded on another; the **Dred Scott portrait never painted at all** (collapsed
box). Entity and place pages carry no large photography.
*Fix:* added a hard image gate to the capture engine — a shot declaring
`requireAlt` will not render until that image reports `complete && naturalWidth>300`,
retrying with a reload up to 3 times, and throwing rather than producing a blank
frame. Dred Scott dropped from the edit.

**13 — QA failure: `/explore` is unusable as a map surface.**
At 1080×1920 it renders a three-pane desktop layout — Filters rail, Records list,
bottom histogram — leaving the map a narrow centre strip. That is precisely the
"generic SaaS UI" the brief rules out.
*Fix:* moved all map shots to the Door (`/`), which is a full-bleed 1080×1920
canvas, with application furniture suppressed by CSS. **OpenStreetMap /
OpenFreeMap attribution deliberately kept** — the tiles are ODbL and attribution
is an obligation, not decoration.

**14 — Concept revision: the fast flurry.**
The four hits at 15.379–16.173 span 0.79s (14–18 frame cuts). A first pass put
four historical images there; the rendered test showed them unreadable, and the
redlining "image" is in fact a hero with the chapter title overlaid.
*Fix:* replaced with three hard map punches — Mississippi (73 pins in frame),
Atlanta, Tulsa — then a **match cut from the Tulsa map frame to the 1921 postcard
of Tulsa burning**. A map reads instantly at that speed; a photograph does not.
The flurry now states the product's proposition instead of decorating it.

**15 — Shot list authored.** `project/shots.mjs`
30 shots, verified contiguous, ending exactly on frame 3264. Shot lengths run
0.23s to 7.37s, set by markers, never by a grid.

**16 — Full capture run.** 4,126 frames including handles.
*Result:* 28/30 on the first pass. `lbj` was refused by the image gate (the gate
ran before the page sweep, so a below-the-fold lazy image never loaded). Fixed
the order. `brand-fg` failed with EPIPE: QTRLE can't go in `.mp4`. Changed to `.mov`.
Both recaptured.

**17 — Rough cut v001.** `project/build-edit.mjs v001` → 3264 frames.
Pass-1 review by per-shot contact sheet. Working: map descent, O Street title,
Du Bois, Data, Memorial, LBJ, the outward pull, the lockup. Broken: Tulsa title
cropped, three city punches indistinguishable, evidence beat was thin-sourced UI
ending in the site footer, lockup competing with pins, and the site nav showing
the BlackStory wordmark throughout (defeats the end reveal).

**18 — Fine cut.** Nav hidden globally (D9), evidence moved to The Count's
reference list (D13), punches re-shot at city scale with an outExpo punch, Tulsa
reframed, Lives re-shot as a sweep through the decade headings, brand scrim
added. 16 shots recaptured. The dev server was SIGTERM'd externally mid-run
(exit 143 after 1h03m, every request 200). Restarted, and the last 4 shots recaptured.

**19 — v002 + QA pass 2.** `scripts/qa_render.py`: 0 blank frames; all 28
cut/join frames sit exactly on their measured markers. Found four joins that are
motion-matched rather than hard cuts, kept as a device (D10), and corrected the EDL.
Sync copy fixed to keep its last frame (`apad`).

**20 — Delivery.** First final was a 411 MB all-intra mezzanine. Added
`scripts/deliver.sh` → `renders/blackstory-love-me-tiktok-v1.mp4`, 112 MB,
16.5 Mb/s, SSIM 0.996 vs master. Cover frame 720 exported.

*Note on missing files:* entries 08–10 and 14 cite `probe-*.mjs` / `test-*.mjs`.
These were one-off investigation scripts, deleted at close-out. Their findings
are recorded above and in DECISIONS.md, and every capture decision they informed
is encoded in `project/shots.mjs`.

**21 — Client review of v002 (2026-09-21).** Rejected: first 11s all map, repetitive
O Street record, cropped text, too much screen recording. Wanted record images,
story text as overlays, a brand-video finish.

**22 — Archive image inventory.** Queried `published.release_entities`: 1,645
image-bearing records in `rel_20260723_authority_net_001`, 515 public-domain and
not-living. Downloaded 43 curated originals plus the Tulsa postcard and Du Bois plate.
Thirteen were too small for full frame. **Found:** the Denmark Vesey record shows a
Frederick Douglass daguerreotype. Filed in beads.

**23 — Motion card system.** `assets/card.html`: full-bleed photo with an authored
push, grade, per-frame seeded grain; framed-print layout; the product's type
(Schibsted Grotesk / Newsreader / Geist Mono); line cards; a typeset citation list
from The Count's real references (`assets/cites-the-count.json`).

**24 — v003 → v004.** 29 cards rendered. QA found the Revels/Carney cut 15 frames off
any marker (my own split) → moved to HIT 7.592. Also found a 2-frame empty flash
opening the citation card → it now opens mid-entrance. v004: 38 cuts, all exactly on
markers. Delivery `tiktok-v2.mp4`, 97 MB.
