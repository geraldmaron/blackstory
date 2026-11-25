# BlackStory brand kit

Everything here is built from one definition. Nothing is drawn by hand or kept as pixels that
cannot be rebuilt.

| What | Where |
| ---- | ----- |
| The definition: the symbol's geometry, the wordmark's font, size and spacing, the mark's colors | `scripts/brand-geometry.mjs` |
| The builder: every file below, from that definition | `scripts/build-kit.mjs` |
| The brand's display font, with its license | `fonts/` (Outfit, SIL Open Font License 1.1) |
| Vector masters | `vector/` |
| Raster exports | `logos/`, `symbols/`, `app-icons/`, `social/` |
| Colors and type as tokens | `tokens/` |
| Checksums of every kit file | `qa/checksums.json` |
| The artwork this kit was measured from | `source/generated-2026-07-18/` |

## Rebuild

```bash
node brand/scripts/build-kit.mjs --apps
```

Writes the kit and replaces every app's served copy (web, docs, mobile). Without `--apps` it
writes only `brand/`. It needs the repo's dev dependencies (`sharp`, `opentype.js`) and nothing
else: no network, no design application, no installed font.

```bash
node brand/scripts/build-kit.mjs --check
```

Builds in memory and fails if any file differs from its definition. Run it after touching
anything under `brand/` or an app's brand folder. SVG, JSON and CSS are compared byte for byte.
A PNG is compared as decoded pixels with a small allowance, because the image encoder and
rasterizer are native libraries whose bytes can differ between machines while the picture does
not; a moved edge or a changed color still fails. The check also confirms that
`qa/checksums.json` lists every kit file.

To change the mark, change `brand-geometry.mjs` and rebuild. Do not edit an exported file.

## The mark

**Symbol.** An upright book with three pages showing behind its cover and a map pin on the
cover. Each page is the same kind of shape: a top edge rising to the left, a rounded top-right
corner, a straight right edge and a half-circle foot. A back page shows as the band between its
own outline and the outline of the page in front grown by a fixed gap. The pin is a circle with
a round hole and two tangents to a point. Every curve is a circular arc, so the symbol is exact
at any size. Its numbers live on a 2048 square.

**Wordmark.** "BlackStory" in Outfit Regular with the font's own kerning, tracked at -0.03 em,
converted to outlines. In the lockup the em is 223.3 units, the letters start at x 525 and stand
on the baseline at y 562.

**One typeface.** Outfit is also the site's display face: every headline is set in it
(`--ds-font-display` on the web, `@expo-google-fonts/outfit` in the mobile app), so the logo and
the headlines are the same letters. Body text, long-form
reading and data keep their own faces (`docs/ui/brand.md`).

**Lockup.** The symbol and the wordmark on a 1672 by 941 canvas. The symbol's 2048 square is
scaled by 0.3034 and placed at (35.5, 177).

**Colors of the mark.**

| Part | Color |
| ---- | ----- |
| Cover and letters on a dark ground | `#F7F3EE` |
| Cover and letters on a light ground | `#0C0C0C` |
| First page | Sand `#E9BF85` |
| Second page and the pin | Copper `#D68149` |
| Third page | Mahogany `#861701` |

These are the mark's own colors. Interface colors are in `tokens/colors.json` and
`docs/ui/brand.md`.

"Dark" and "light" in a file name are the ground the file is made for: a `dark` file has a
paper cover and paper letters.

## Files

**`vector/`** (SVG, the masters to hand to a printer or a vendor)

- `BlackStory-lockup-{dark,light}.svg`: symbol and wordmark on the full canvas. The wordmark is
  outlines, so no font is needed to open it.
- `BlackStory-lockup-{dark,light}-tight.svg`: the same, cropped exactly to its ink. Use this
  when a layout sets its own space around the mark, so nothing has to know where the letters
  end.
- `BlackStory-symbol-{dark,light}.svg`: the symbol alone.
- `BlackStory-wordmark-{dark,light}.svg`: the wordmark alone, cropped to its ink.

**Raster exports** (transparent PNG unless noted)

- `logos/{theme}/BlackStory-primary-lockup-{theme}-transparent.png`: 1672 by 941.
- `symbols/{theme}/BlackStory-symbol-{theme}-transparent[-512|-1024|-2048].png`.
- `app-icons/{theme}/BlackStory-app-icon-{theme}-{16…1024}.png`: opaque full-bleed squares.
  An operating system rounds its own corners.
- `social/{theme}/BlackStory-avatar-{theme}-512.png` and
  `BlackStory-social-banner-{theme}-1200x630.png`: opaque.

**Served copies**, written by `--apps`

| App | Files |
| --- | ----- |
| `apps/web/public/brand`, `apps/docs/public/brand` | `lockup-*.png` (1600 by 900), `lockup-*.svg`, `lockup-tight-*.svg` (cropped to the ink, no margin), `symbol-*.png` (512), `symbol-*.svg`, `favicon-*-{16,32,48}.png` (rounded tile), `apple-touch-icon-*-180.png`, `open-graph-*-1200x630.png` |
| `apps/web/public/brand` only | `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `icon-maskable-dark-512.png`, `email-lockup.png` |
| `apps/web/src/app/front` | `live-lockup.css`, the numbers for the one place the web sets the wordmark as live text |
| `apps/mobile/assets/brand` | the lockup and the 1024 symbol |
| `apps/mobile/assets/images` | `icon.png`, `favicon.png`, and Android's `android-icon-{foreground,background,monochrome}.png` |

Web code reaches these through `BRAND_ASSETS` in `packages/config`, never by file name.

After a rebuild that changes the social banner, bump the `v=` on `BRAND_ASSETS.openGraph` so
link previews refetch it.

## Setting the wordmark as live text

Use the artwork wherever it will do. Where the letters have to be real text (the front page's
last scene, where "Black History" closes into "BlackStory"), set them in the display face at the
weight and tracking in `tokens/live-lockup.json` and stand the symbol beside them using the same
file. The build writes those numbers as CSS custom properties for the web
(`apps/web/src/app/front/live-lockup.css`), so the page holds no copy of its own. Its values are in ems of the text: how far the "B"'s ink sits inside its box, where the
baseline falls in a line of height 1, and the symbol's square relative to the ink's left edge
and the baseline. Set that way, the text and the symbol are the lockup, to the pixel. Typing the
name in any other face, weight or spacing beside the symbol is still misuse
(`docs/ui/brand.md`).

## Use

Clear space, minimum sizes and misuse are in `docs/ui/brand.md`, "The signature". X, the unit of
clear space, is the pin's width: 217 units on the symbol's 2048 square.

## Where this came from

The first kit (2026-07-18) was generated as images. The approved reference and the guide pages
carry content-credential metadata naming an image model as their source. It had no vector, no
font and no way to rebuild a file, and its letters matched no typeface, which surfaced on
2026-11-24 when the front page needed to type the wordmark.

This kit was rebuilt from measurements of that artwork on 2026-11-24:

- The symbol's lines and arcs were fitted to the 2048 export. The rebuilt symbol covers 97
  percent of the same pixels. The clear strip between pages is narrower along the tops than
  along the sides, as it was in the artwork; the geometry refuses to build if a page would
  cross the page in front of it.
- The wordmark is new lettering in a real font. 33 open faces were fitted to the artwork's
  letters (same capital height, width, left edge and baseline) and scored by how much of the
  artwork's shape each covered. Outfit Regular was the closest with the artwork's one-storey
  "a" (71 percent, against 53 for Red Hat Display, the first pick by eye), and its capital and
  lowercase heights are the artwork's. The one visible difference is the "y", whose tail is
  straight where the artwork's curled. The tracking is slightly looser than the artwork's so
  that no letters touch, which makes the word 1.5 percent wider.
- The pin, which was textured in the old lockup, is flat copper.

The originals are kept unchanged in `source/generated-2026-07-18/`, including the old guide,
whose type and color pages are superseded by `docs/ui/brand.md`.

**Trademark.** Application SN 50121092 (filed 2026-09-21) was made on a drawing of the original
lockup, kept in the owner's records. The symbol here is the same design. The lettering is very close
but not identical. Whether continued use in the new lettering supports that application is a
question for a trademark attorney and has not been answered.
