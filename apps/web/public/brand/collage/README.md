# Archive collage tiles

Black-and-white mosaic source tiles for the missing-`primaryImage` silhouette
mark on entity pages (`EntityArchiveCollage`).

- Built from rights-cleared public-media promotions (Commons auto_propose).
- Regenerated with:
  `node --conditions development --import tsx packages/firebase/scripts/build-archive-collage-tiles.ts`
- UI applies SVG silhouette masks (afro, fist, book, pin, arch) and a grayscale
  filter. Captions state these are symbolic — never a portrait of the record.
