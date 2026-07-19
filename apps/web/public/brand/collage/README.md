# Archive collage tiles

Black-and-white mosaic source tiles for story atmosphere masts and the about-page
living mosaic (not entity pages).

- **Entity pages** (`/entity/[id]`) use `EntityRecordMark` when there is no primary image — not
  collage mosaics.
- **Story atmosphere masts** (`/stories/[slug]`) use these tiles as a soft B&W mosaic via
  `AtmospherePlane` + `selectAtmospherePlane` (mosaic default; geometric SVG fallback when tiles
  fail, Save-Data, or reduced motion).
- **About** (`/about`) uses `LivingAtmosphereMosaic` in the desktop gutter (and a band under the
  lede on narrow viewports): same collage language, with individual tiles swapping in/out from
  the pool. Swaps pause under reduced-motion, Save-Data, or a hidden document.
- **Credits** for tile sources: `/stories/mosaic-credits`.

Built from rights-cleared public-media promotions (Commons auto_propose). Regenerates local
tiles, `manifest.json`, and `tile-credits.ts`:

```bash
node --conditions development --import tsx packages/firebase/scripts/build-archive-collage-tiles.ts
```
