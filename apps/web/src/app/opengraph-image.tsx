/**
 * Default OG/social preview image, generated at request time from the same
 * mark geometry that drives <BlackBookLogo /> (packages/ui/src/brand/BlackBookLogo.tsx)
 * — one source of truth, no static asset to keep in sync by hand.
 */
import { ImageResponse } from 'next/og';
import { BlackBookMark, brandPalette } from '@black-book/ui';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const MARK_SIZE = 260;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40,
          background: brandPalette.archivePaper,
        }}
      >
        <div style={{ display: 'flex', width: MARK_SIZE, height: MARK_SIZE }}>
          <BlackBookMark
            ink={brandPalette.blackInk}
            paper={brandPalette.archivePaper}
            accent={brandPalette.copperPin}
            pageColors={[brandPalette.archivePaper, brandPalette.pageSand, brandPalette.archivePaper, brandPalette.copperInk]}
            detail="full"
          />
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: 12,
            color: brandPalette.blackInk,
          }}
        >
          BLACK BOOK
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: brandPalette.copperPin,
          }}
        >
          History, pinned to place.
        </div>
      </div>
    ),
    { ...size },
  );
}
