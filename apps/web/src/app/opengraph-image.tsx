/**
 * Default OG/social preview image, generated at request time from the same
 * construction-grid geometry that drives <BrandMark />
 * (packages/ui/src/brand/geometry.ts) — one source of truth, no static
 * asset to keep in sync by hand.
 */
import { ImageResponse } from 'next/og';
import { PIGMENT_SCATTER_MAP, brandInk, buildSocialLayout, pigmentScale } from '@black-book/ui';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function blockColor(letter: 'first' | 'second', cellIndex: number): string {
  if (letter === 'second') {
    return brandInk.solid;
  }
  const toneIndex = PIGMENT_SCATTER_MAP[cellIndex] ?? 0;
  return pigmentScale[toneIndex]?.hex ?? brandInk.solid;
}

export default function OpengraphImage() {
  const layout = buildSocialLayout(size.width, size.height, 260);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#FFFFFF',
        }}
      >
        {layout.blocks.map((block) => (
          <div
            key={`${block.letter}-${block.cellIndex}`}
            style={{
              position: 'absolute',
              left: layout.offsetX + block.x * layout.scale,
              top: layout.offsetY + block.y * layout.scale,
              width: block.size * layout.scale,
              height: block.size * layout.scale,
              background: blockColor(block.letter, block.cellIndex),
              display: 'flex',
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: layout.offsetY + 260 + 56,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 10,
            color: brandInk.solid,
          }}
        >
          BLACK BOOK
        </div>
      </div>
    ),
    { ...size },
  );
}
