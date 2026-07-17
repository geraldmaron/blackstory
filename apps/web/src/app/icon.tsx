/**
 * Browser tab / bookmark icon, generated at request time from the same
 * mark geometry that drives <BlackBookLogo variant="mark" />
 * (packages/ui/src/brand/BlackBookLogo.tsx) — one source of truth, no
 * static asset to keep in sync by hand.
 */
import { ImageResponse } from 'next/og';
import { BlackBookMark, brandPalette } from '@black-book/ui';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: brandPalette.blackInk,
        }}
      >
        <div style={{ display: 'flex', width: 52, height: 52 }}>
          <BlackBookMark
            ink={brandPalette.archivePaper}
            paper={brandPalette.blackInk}
            accent={brandPalette.copperPin}
            pageColors={[brandPalette.copperPin, brandPalette.archivePaper]}
            detail="compact"
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
