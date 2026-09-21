# BlackStory × "Love Me" (AMBNT) — TikTok advertisement

A ~54-second vertical social video cut to the AMBNT "Love Me" edit-audio, built
entirely from deterministic captures of the live BlackStory application.

**Current approved render is named in [STATUS.md](STATUS.md).** The current cut (v004) is built from `project/edit-v3.mjs` with `render-v3.mjs` and `build-v3.mjs`; the v002 pipeline (`shots.mjs`, `build-edit.mjs`) still supplies the map, Lives, Data and Memorial captures it reuses. Image provenance: `assets/media/PROVENANCE.md`.

---

## 1. Where the source material came from

| Thing | Source |
|---|---|
| Reference post | `https://www.tiktok.com/@ambnt.prod/video/7670347350115634462`, retrieved directly with yt-dlp — no mirror needed |
| Reference file | `reference/ambnt-7670347350115634462.mp4` (54.4276s, 1080×1920, 59.94fps, HEVC/AAC) |
| Audio | demuxed from that file to `audio/reference-mono48k.wav` (analysis) and `audio/reference-stereo48k.wav` (review mux) |
| Footage | captured from BlackStory's local dev server at `http://localhost:3048`, Postgres-backed, serving live `published` data |

Full provenance, including how the post identity was verified before download,
is in [SOURCES.md](SOURCES.md).

**The reference is not a visual template.** Its video track is a screen recording
of a DAW arrangement — a producer showcasing an edit-audio build. Measured mean
inter-frame motion is 0.0017. There is no cutting grammar in it to copy. What it
supplies is the audio. See [DECISIONS.md](DECISIONS.md) §D1.

## 2. How the audio was analysed

```bash
python scripts/analyze_reference_video.py   # cuts, motion, luma of the reference video
python scripts/analyze_audio.py             # dense curves       -> audio/analysis.json
python scripts/build_markers.py             # discrete markers   -> audio/markers.json
```

`audio/markers.json` is the authoritative timing document. Three measured
detectors at a 128-sample hop (2.67ms, finer than one video frame):

- **GAP** — the track's engineered silences (hardest cut points available)
- **HIT** — sub-band (20–110Hz) transient attacks, backtracked to the attack foot
- **VOX** — merged vocal phrases carrying a pYIN-measured *sustain* length, which
  is what identifies the held "meee" notes

Tempo (80 BPM) is recorded as metadata and is **never used to place a cut**.
librosa's own beat tracker returns 123.6 BPM here, which is an octave error —
cutting to it would have put every cut in the wrong place. See DECISIONS §D2.

Requires: `numpy`, `scipy`, `librosa`, `soundfile`.

## 3. How the captures were produced

Not screen recordings. Each frame's camera state is computed from an authored
easing function, applied, and screenshotted; frames pipe straight into ffmpeg.
Dropped frames, scroll jank and animation drift are structurally impossible.

- Map shots drive MapLibre directly through `window.__bpMapStage` (`jumpTo` per
  frame) — exact centre, zoom, pitch and bearing on every frame.
- Page shots move the document with a compositor transform, not scroll, so there
  is no reflow and text re-rasterises sharp at any push-in.
- Captured at 2160×3840 (deviceScaleFactor 2) and downscaled to 1080×1920 with
  lanczos — supersampled, not resampled.
- Every capture carries handle frames past both ends of its edit length.

```bash
cd project
npm install && npx playwright install chromium
node capture.mjs               # all 30 shots (~4,100 frames)
node capture.mjs map-a lbj     # or a subset by name
```

The dev server must be running first (`preview_start {name:"web"}`, port 3048).
Map capture **requires dev**: `window.__bpMapStage` is exposed only under
`NODE_ENV !== 'production'` (`MapStage.tsx:1427`).

## 4. How the edit is assembled

```bash
cd project
node build-edit.mjs v002       # -> ../renders/blackstory-love-me-v002*.mp4 (mezzanine)
../scripts/deliver.sh ../renders/blackstory-love-me-v002.mp4 ../renders/blackstory-love-me-tiktok-v1.mp4
python ../scripts/qa_render.py ../renders/blackstory-love-me-v002.mp4 ../renders/blackstory-love-me-v002-synccheck.mp4
node write-docs.mjs            # regenerate EDIT-TIMELINE.md + CAPTURE-MANIFEST.md
```

Three stages: trim each capture to its exact frame length (discarding handles),
concatenate by stream copy (no generational loss), then composite the brand
lockup and mux audio. Captures are encoded near-all-intra so a cut on any frame
is exact.

## 5. Rendering it again

Everything above is deterministic and re-runnable. `renders/` is versioned;
nothing is overwritten. Start the dev server, run `capture.mjs`, run
`build-edit.mjs <version>`.

## 6. Which file is current

See [STATUS.md](STATUS.md). It always names the approved render.

## 7. Where to change timing or swap a shot

- **Cut timing** — `project/shots.mjs`. Every shot carries `in`/`out` frame
  numbers on the 59.94fps timeline. They must stay contiguous and end on 3264;
  `capture.mjs` and `write-docs.mjs` both assert this.
- **Movement inside a shot** — the `step` function on that shot. Map shots use
  `mapMove(from, to, easing, holdFrames)`; page shots use
  `pageMove(selector, nth, z0, z1, bias0, bias1, easing)`.
- **Which record appears** — the `url` and the selector the shot frames on.
  Selectors may be `alt:<substring>`, `text:<substring>` or plain CSS.
- **Re-cut without recapturing** — handles allow a cut to slide ~12 frames
  either way; change `in`/`out` and re-run `build-edit.mjs` only.
- **The closing lockup** — `assets/brand-card.html`.

## 8. Required assets

- `reference/ambnt-7670347350115634462.mp4` (audio source)
- `audio/markers.json` (timing)
- `captures/**` (footage) and `captures/manifest.json`
- `assets/brand-card.html` (lockup; loads Schibsted Grotesk + Newsreader from
  Google Fonts — the same faces the application uses. Fonts are referenced, not
  redistributed.)

## 9. Versions that matter

ffmpeg 8.1.2 · Node 24.19.0 · Playwright 1.49 / Chromium 1243 · Python 3.14.5 ·
librosa 1.0.0 · numpy 2.5.3 · yt-dlp 2026.08.19.

Chromium is launched with `--use-angle=metal` and GPU enabled; without it the
MapLibre canvas will not render headless.

## 10. What has already been tried and rejected

| Tried | Why rejected |
|---|---|
| Treating the reference as a visual template | It is a DAW screen recording with no cutting grammar (measured) |
| BPM-derived cut grid | Forbidden by the brief, and librosa's tempo here is an octave out |
| Capturing from production `blackstory.app` | `__bpMapStage` is dev-only, so no authored camera work |
| Real-time screen recording | Cannot guarantee no dropped frames / scroll jank |
| Scroll-driven page movement | Reflow, scroll anchoring, lazy-load pop mid-shot |
| ffmpeg `zoompan` for push-ins | Softer than re-rasterising in the browser |
| `/explore` as the map surface | Three-pane desktop layout; map reduced to a strip |
| Dred Scott portrait | Never paints — external image fails to load (verified over 90s) |
| Constitution image | Loads only intermittently; not worth the risk for its value |
| Four historical images in the 0.79s flurry | Unreadable at 14–18 frames; replaced with map punches |
| Presidential portraits | On BlackStory they sit in a specific "presidents on the record" context; out of context in a fast cut they would misrepresent the record |
| Pre-baking the music into the upload master | Breaks sound attribution on TikTok, invites Content ID muting, and the recording is a third party's. See DECISIONS §D3 |

## 11. Deliverables

| File | What it is |
|---|---|
| `renders/blackstory-love-me-tiktok-v1.mp4` | **Upload file** (delivery encode). Silent track: attach the AMBNT sound in TikTok. |
| `renders/blackstory-love-me-tiktok-v1-synccheck.mp4` | Review copy with the reference audio. Not for distribution. |
| `renders/blackstory-love-me-<v>.mp4` | Near-all-intra master from `build-edit.mjs`. Feed it to `scripts/deliver.sh`. |
| `renders/cover-frame-0720.png` | Recommended cover frame |
| `EDIT-TIMELINE.md` | Frame-accurate EDL, generated |
| `CAPTURE-MANIFEST.md` | Every capture, generated |
| `QA.md` | Visual / audio / content / export review |
| `captures/` | Source footage, organised by surface |
