/**
 * Browser tab / bookmark icon, generated at request time from the same
 * construction-grid geometry that drives <BrandMark />
 * (packages/ui/src/brand/geometry.ts) — one source of truth, no static
 * asset to keep in sync by hand.
 */
import { ImageResponse } from 'next/og';
import { brandInk, buildGlyphLayout } from '@black-book/ui';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

// The glyph is taller than it is wide (5:7) — fit both axes so nothing
// clips, and leave a little breathing room instead of touching the edge.
const MARGIN_FRACTION = 0.14;

export default function Icon() {
  const layout = buildGlyphLayout({ gutter: 0 });
  const targetWidth = size.width * (1 - MARGIN_FRACTION * 2);
  const targetHeight = size.height * (1 - MARGIN_FRACTION * 2);
  const scale = Math.min(targetWidth / layout.width, targetHeight / layout.height);
  const offsetX = (size.width - layout.width * scale) / 2;
  const offsetY = (size.height - layout.height * scale) / 2;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          // Solid black tile, not transparent: a black-on-transparent glyph
          // disappears against dark browser chrome. This also states the
          // brand plainly — "it is black" — in the smallest surface we have.
          background: brandInk.solid,
        }}
      >
        {layout.blocks.map((block) => (
          <div
            key={block.cellIndex}
            style={{
              position: 'absolute',
              left: offsetX + block.x * scale,
              top: offsetY + block.y * scale,
              width: block.size * scale,
              height: block.size * scale,
              background: brandInk.solidInverse,
              display: 'flex',
            }}
          />
        ))}
      </div>
    ),
    { ...size },
  );
}
