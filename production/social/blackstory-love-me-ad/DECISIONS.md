# DECISIONS

Material creative and technical decisions only.

---

## D1 — Treat the reference as an audio source, not a visual template

**Decision.** Reinterpret the reference's *musical* grammar; derive all visual grammar
from the audio structure and from BlackStory itself.

**Why.** The brief assumed the reference was an edit whose cutting style could be
reinterpreted. Measurement disproved that: the video track is a screen recording of a DAW
arrangement (caption: *""Love Me" But It's Designed For Edits"*), mean inter-frame motion
0.0017, luma flat at 0.126–0.151. There is no cutting, no camera movement and no
transition vocabulary in it to study. What it *is* is a producer's showcase of an
edit-audio build — which is precisely why the audio is so richly structured.

**Alternatives considered.** (a) Imitate the DAW aesthetic — rejected, it would make a
BlackStory ad look like a music-production post and communicate nothing about the product.
(b) Find a different reference edit using the same sound — rejected, the brief names this
exact post and its audio, and substituting a different creator's edit would replace a
verified source with an unverified one.

**Consequence.** The brief's requirement that the audio control the edit becomes the
entire method. The DAW view is repurposed as labelled ground truth for validating onset
detection. Section 2 of the brief (analyse the reference's cuts, speed ramps, whips) is
answered by measurement showing there are none, rather than by inventing findings.

---

## D2 — Markers are measured; tempo is recorded but never used as a grid

**Decision.** Every cut lands on a timestamp produced by a detector run over the waveform.
BPM is written into markers.json as metadata and is not used to place anything.

**Why.** The brief explicitly forbids approximating the cut grid from BPM. It also turned
out to matter: librosa's beat tracker returned 123.6 BPM, which is an octave error. The
true tempo is 80 BPM, established independently from the measured 3.000s spacing of the
engineered silences. Cutting on a 123.6 BPM grid would have put every cut in the wrong
place while looking rigorous.

**Consequence.** Shot lengths in the final cut are irregular by construction — 0.49s to
6.63s — because the music is irregular.

---

## D3 — Two audio deliverables: a silent upload master and a local sync-check copy

**Decision.** The primary deliverable renders with a silent audio track, intended for
upload with the AMBNT sound attached inside TikTok. A second render, with the reference
audio muxed, is kept in `renders/` as a local review copy for verifying sync.

**Why.** Three reasons, in order of weight:
1. It is the correct TikTok workflow. Attaching the sound in-app is what makes the post
   appear in that sound's feed and attributes it to @ambnt.prod. A video with the track
   pre-baked does not get that attribution — which directly undercuts the brief's own
   goal of feeling native to the trend rather than pasted onto it.
2. Pre-baked commercial audio is what Content ID mutes. A muted ad is a dead ad.
3. The underlying recording is a third-party copyrighted work (JMSN, "Love Me"). Shipping
   a distributable file with it embedded is not mine to authorise.

The sync-check copy exists because a silent file cannot be reviewed for musical sync, and
reviewing the cut against the scratch track is ordinary practice. It is labelled as a
local working artifact, not a distribution master.

**Alternatives considered.** (a) Ship only the muxed version — rejected for the reasons
above. (b) Ship only the silent version — rejected, it would make the central quality
claim of this project unverifiable by the person who commissioned it.

**Consequence.** The edit must be frame-aligned to an audio start of 0.000 so that
attaching the sound in TikTok lands in sync with no offset. The first frame of video is
the first frame of audio.

---

## D4 — Capture from the local dev server, not production

**Decision.** All footage is captured from `http://localhost:3048`.

**Why.** `MapStage.tsx:1427` exposes the MapLibre instance on `window.__bpMapStage` only
when `NODE_ENV !== 'production'`. That handle is the difference between authored camera
work — exact center, zoom, pitch, bearing, per frame — and shoving synthetic wheel events
at a map and accepting whatever it does. Verified absent on blackstory.app and present on
dev. The dev server is Postgres-backed and serves the same live `published` data, so the
content on screen is the real archive, not seed data.

**Alternatives considered.** (a) Capture production with synthesised mouse input —
rejected: stepped wheel zoom is visibly jittery and the inertia is unauthored. (b) Patch
a hook into a production build — rejected as more invasive than using the dev affordance
that already exists for exactly this purpose.

**Consequence.** Routes compile on demand, so every route is pre-warmed before capture,
and the dev indicator is suppressed. Captured frames are checked against production
screenshots for visual parity.

---

## D5 — Deterministic frame rendering rather than real-time screen recording

**Decision.** Each frame's camera/scroll state is computed from an authored easing
function, applied, and screenshotted. Frames are piped into ffmpeg. Nothing is recorded
in real time.

**Why.** The brief's quality bar rules out scroll stutter, dropped frames, jagged
scrolling, loading states and cursor artifacts. A real-time recording can only *hope* to
avoid these. Frame-stepping makes them structurally impossible, and hands over exact
authorship of easing, speed ramps and shot length in frames — which is what cutting to
frame-accurate markers requires.

**Cost, and how it is paid.** Animations driven by the page's own rAF clock would freeze
under frame-stepping. This affects exactly one surface, the Memorial, whose name-wall
animates continuously. Handled per D6.

**Consequence.** Capture is slower than real time, and every shot is reproducible
byte-for-byte from its spec.

---

## D6 — The Memorial is captured on a driven clock, and cut slowest

**Decision.** The Memorial's ambient animation is advanced deterministically alongside the
camera, and the section is cut with the longest holds in the piece and no transitions.

**Why (placement).** The audio decides this, not taste. From 28.051s the sub-bass drops
out entirely for ~11s while a single vocal phrase runs 6.13s with a 4.18s steady-pitch
hold, followed by a second 6.90s phrase. It is the only passage in the track with
sustained exposed vocal and no low end — the one place the arrangement stops pushing.
That is where the brief asks for the emotional breath, and the music agrees.

**Why (treatment).** The Memorial is also the only light-background surface in a dark
product (rgb 248,244,236 against rgb 19,17,16). The cut into it is therefore already the
strongest visual event available without any effect applied — which is the argument for
applying none.

**Consequence.** 14.1s, roughly a quarter of the running time, is spent on four shots.
That is deliberate and is the reason the final sequence reads as an escalation.

---

## D7 — 59.94 fps, matching the reference exactly

**Decision.** Render at 60000/1001, 3264 frames, rather than a round 60 or 30.

**Why.** Markers are measured in seconds and converted to frames; rendering at the
reference's own rate means the marker frame numbers are exact rather than rounded, and the
edit cannot drift against the audio over 54s. 30fps was rejected because the piece contains
continuous camera motion where 60 reads materially smoother.

---

## D8 — No editorial text over product shots

**Decision.** The only typography in the piece is the closing lockup. None of the candidate
lines ("Look closer.", "This happened here.") are used.

**Why.** The product's own pages already carry strong, specific, real language — a place
name, a date, an evidence grade, a citation. Overlaying ad copy on top of a surface that
is already saying something true and specific makes it look less credible, not more. The
brief permits omission if the visuals carry it; they do.

**Consequence.** The closing line *History, pinned to place.* lands as the first and only
authored sentence in the piece.

---

## D9 — The site's own nav is hidden on every shot

**Decision.** `header.ds-bar` and footers are kept out of frame everywhere.
**Why.** Not cosmetic. The brief's premise is that the viewer realises it's
BlackStory only at the end. The nav carries the BlackStory wordmark, so v001 was
announcing the brand from the first record onward.
**Consequence.** The first time the name appears is the closing lockup.

## D10 — Motion-matched joins at three of the hits, instead of cuts

**Decision.** At 6.405s and 9.459s the camera sits dead still through the silence
and launches on the hit. At 3.440s it jumps about 20× in speed. The frames either
side are continuous.
**Why.** Found in QA, not planned: the frame-difference check showed no pixel
change at those frames. Played against the audio this is the stronger device:
silence equals stillness, the hit equals motion. A hard cut into another map frame
would have spent the hit on a change of framing instead of a change of energy.
**Alternative.** Offset the incoming camera to force a visible cut. Rejected.
**Consequence.** EDL lists these as joins, not cuts.

## D11 — The fast flurry is places, not pictures

**Decision.** The four hits at 15.38–16.17s are three map punches (Jackson MS,
Atlanta, Tulsa) and a match cut to the 1921 Tulsa postcard hero.
**Why.** At 14–18 frames a photograph can't be read and a map can. And "Tulsa →
TULSA RACE RIOT 6-1-1921" is a conceptual match cut: the place, then what happened
there.

## D12 — OpenStreetMap attribution stays on the map shots

**Decision.** The attribution control is left visible at reduced opacity.
**Why.** The tiles are ODbL-licensed and attribution is a licence obligation. It
sits in TikTok's caption zone, where it can be covered, but it is not removed.

## D13 — The evidence beat comes from The Count, not O Street Market

**Decision.** Evidence and provenance come from the chapter's numbered reference list.
**Why.** O Street Market's own evidence block reads "coverage: minimal / not linked
yet". Showing it would be honest but would undercut the beat. The Count's list
resolves every mark to a primary source: the 1790 census return, Art. I §2,
*Dred Scott v. Sandford*.

## D14 — The master is a mezzanine; delivery is a separate encode

**Decision.** `renders/<v>.mp4` stays near-all-intra (~60 Mb/s). `scripts/deliver.sh`
produces the upload file at CRF 16 / 30 Mb/s cap, 1s GOP.
**Why.** An all-intra file is right for frame-exact editing and wrong for a phone
upload (411 MB). Delivery measured SSIM 0.996 against the master at 112 MB.

---

## D15 — Revision 2: records carry the piece, not screen recordings

**Decision.** v004 rebuilds the edit around real record photographs and on-screen
type, keeping product captures only where the product itself is the picture (the
map, Lives, Data, Memorial).
**Why.** Client review of v002: the first 11s were only map zooms, the O Street
record repeated, and pushed-in captures cut text off. The archive holds 1,645
image-bearing records in the current release, and v002 used almost none of them.
**Consequence.** 27 of 38 shots are motion cards rendered from `assets/card.html`.
No text is ever cropped: type is set, not photographed.

## D16 — The three silences say "Her / His / Their Story happened here."

**Decision.** Line cards in the product's Door headline style. The lockup
then resolves the pattern as "BlackStory."
**Why.** This is BlackStory's own copy (the Door cycles His / Her / Their / Your /
Black Story), so it's owned rather than invented, and it lets the brand arrive
as the answer to a pattern the viewer has already read three times.

## D17 — Casting rules for faces in an advertisement

**Decision.** Public-domain images only. Persons only if the record is marked
`deceased`. Figures whose estates actively enforce publicity rights are
avoided (King, Ali, Robinson, Jackson), as is the LBJ signing photo (it includes Dr. King).
**Why.** Public domain covers the photograph, not the use of a person's likeness
to promote a product. Several states protect a likeness for 70–100 years after
death. Records with no `livingStatus` include living people (e.g. Barack Obama),
so absence was not treated as safe.
**Consequence.** The cast is 18th- to early-20th-century figures. Images under
~700px were excluded from full-frame. Mid-size originals are shown as framed prints.

## D18 — Every caption is the record's own words

**Decision.** Place = the record's `locationLabel` (shortened to city/state) or a
place named in its story. Year = a year stated in its story. Story lines are verbatim
clauses. Two drafted captions ("for the Paris Exposition", "Greenwood") were
replaced with the record's wording because the records don't say them.
