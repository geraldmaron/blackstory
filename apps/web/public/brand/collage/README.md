# Archive collage tiles

Black-and-white mosaic source tiles for story atmosphere masts (not entity pages).

- **Entity pages** (`/entity/[id]`) use `EntityRecordMark` when there is no primary image — not
  collage mosaics.
- **Story atmosphere masts** (`/stories/[slug]`) use these tiles as a soft B&W mosaic via
  `AtmospherePlane` + `selectAtmospherePlane` (mosaic default; geometric SVG fallback when tiles
  fail, Save-Data, or reduced motion).
- **Credits** for tile sources: `/stories/mosaic-credits`.

Built from rights-cleared public-media promotions (Commons auto_propose). Regenerate with:

```bash
node --conditions development --import tsx packages/firebase/scripts/build-archive-collage-tiles.ts
```
