# SOURCES — provenance

## Reference post

| Field | Value |
|---|---|
| URL | https://www.tiktok.com/@ambnt.prod/video/7670347350115634462 |
| Video ID | 7670347350115634462 |
| Creator handle | @ambnt.prod |
| Creator display name | MADE BY AMBNT |
| Post caption | "SoundCloud Link in bio! \|Trendslop and Synthslop in the same post 🤩 . . . #remix #editaudio #loveme #jmsn #viral" |
| Retrieved | 2026-09-20 |
| Method | `yt-dlp 2026.08.19`, direct from TikTok |
| Mirror used | **None.** Direct retrieval succeeded; no mirror was needed, so no mirror verification was required. |
| Stored as | `reference/ambnt-7670347350115634462.mp4` (2.14 MiB) |

### Verification that the retrieved file is the referenced post

1. TikTok's own oEmbed endpoint was queried for the exact URL before download and
   returned `author_url = https://www.tiktok.com/@ambnt.prod` and
   `data-video-id="7670347350115634462"` — matching the ID in the brief.
2. `yt-dlp` was given that same canonical URL and reported
   `[TikTok] 7670347350115634462: Downloading webpage`, i.e. it resolved the same ID.
3. The downloaded file's caption/track tags (`#loveme #jmsn #editaudio`) match the
   oEmbed title returned for the original post.

### Measured properties of the retrieved file

| Property | Value |
|---|---|
| Container | mp4 |
| Duration | 54.4276s (audio 54.4276s, video 54.4211s) |
| Video | HEVC, 1080×1920, 2997/50 = 59.94 fps, 3262 frames |
| Audio | AAC, 44.1 kHz, stereo |
| Overall bitrate | 329 kb/s |

### What the reference actually contains

The video track is a screen recording of a DAW arrangement view, captioned
*""Love Me" But It's Designed For Edits"*. Measured mean inter-frame motion 0.0017,
luma range 0.126–0.151, fade to black from 52.44s. Track names legible in the
arrangement: `Love Me` (vocal), `HIGH CHORDS`, `SAW CHORDS`, `SAW LEAD`, `ARP`, `SUB`,
`BASS`, `HIT`, `HIT 1`, `WOOSH HIT`, `BOOM`, `F#`, `SUCKBACK`, `DOWNER`, `RISER`.

## Music

The audio is an AMBNT edit/remix of **JMSN — "Love Me"**. The underlying composition and
recording are third-party copyrighted works. Nothing in this project claims any right in
them. See DECISIONS.md §D3 for how this governs the deliverables.

## Product

| Field | Value |
|---|---|
| Live site | https://blackstory.app (inspected 2026-09-20, all 15 candidate routes HTTP 200) |
| Repository | geraldmaron/blackstory |
| Branch inspected | `staging` |
| Commit at capture | recorded in CAPTURE-MANIFEST.md |
| Capture target | local dev server, `http://localhost:3048`, Postgres-backed, serving live `published` data |

Note on access: `blackstory.app/robots.txt` disallows `ClaudeBot` and `anthropic-ai`.
That directive governs crawlers. This work was performed at the direct instruction of the
site's owner, against the owner's own site and their own local dev server, driving a
normal browser rather than crawling. No crawler identity was used.

## Historical media appearing in the video

All imagery on screen is served by BlackStory itself from its own records. No third-party
media was introduced into the edit, and no image was generated. The BlackStory record
behind each shot containing historical media is recorded per-shot in CAPTURE-MANIFEST.md.

## Tools

| Tool | Version | Use |
|---|---|---|
| yt-dlp | 2026.08.19 | reference retrieval |
| ffmpeg / ffprobe | 8.1.2 | demux, analysis, encode |
| Python | 3.14.5 | analysis scripts |
| librosa | 1.0.0 | onset / pitch / spectral analysis |
| numpy | 2.5.3 | frame-difference and envelope analysis |
| Node | 24.19.0 | capture + build pipeline |
| Playwright | 1.49+ | deterministic browser capture |
| Chromium | 1243 (Chrome for Testing) | capture browser |

## Fonts

The closing lockup uses the typefaces the product itself serves (Geist family, and the
display serif used by the site's editorial pages). They are referenced from the running
application at capture time and are **not** redistributed in this project directory.
