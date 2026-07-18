# Black Book Brand Identity System - Final

The Pinned Page symbol is the first **B** in **Black Book**. The visible wordmark begins with **lack Book**.

## Start here

- `guide/black-book-brand-guide-final.pdf` - complete standards guide
- `assets/svg/` - outlined vector masters
- `assets/png/` - transparent PNG exports and app icons
- `assets/icons/` - favicons, Apple touch icons, and social avatars
- `assets/social/` - Open Graph and social banner assets
- `tokens/` - CSS and JSON design tokens
- `implementation/` - Next.js, CSS, and HTML usage examples
- `asset-manifest.json` - file inventory with SHA-256 checksums
- `qa-report.md` - final validation record

## Where product surfaces consume these assets

This directory is the checksummed master archive; it is not served directly.
Web-served copies of the SVG masters, favicons, touch icons, and social/Open
Graph images live at `apps/web/public/brand/` (referenced as `/brand/...`,
matching the `implementation/` examples). When a master changes, re-copy it
there and refresh `asset-manifest.json` and `sha256sums.txt`.

## Type system

- Display and UI: Inter Display + Inter
- Editorial and longform: Source Serif 4
- Data and citations: IBM Plex Mono

Font files are intentionally not included. Use licensed or open-source distribution channels for installation.
