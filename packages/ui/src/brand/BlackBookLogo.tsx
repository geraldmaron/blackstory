/**
 * The Black Book "Pinned Page" mark: a closed-book cover forms an
 * asymmetric B, curved page-edge bands are exposed at the spine, and a
 * location pin is integrated into the lower-left of the cover — "history,
 * pinned to place." Geometry is original (not a font glyph or stock icon);
 * source of truth is this component, ported from the owner-supplied brand
 * package (2026-07-17). See docs/ui/brand.md for usage rules.
 */
import * as React from 'react';
import { brandPalette } from '../tokens/brand-palette.js';

export type BlackBookLogoVariant = 'mark' | 'horizontal' | 'stacked' | 'app-icon';

export type BlackBookLogoDetail = 'full' | 'compact';

export interface BlackBookLogoProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
  /**
   * mark: symbol only
   * horizontal: symbol + wordmark
   * stacked: symbol above wordmark
   * app-icon: rounded-square application icon
   */
  variant?: BlackBookLogoVariant;
  /** Width of the symbol in CSS pixels. */
  size?: number;
  /** Primary logo color (book cover + B bowls). */
  ink?: string;
  /** Color shown through the pin's punch-through hole; match the surface behind the mark. */
  paper?: string;
  /** Location marker color. */
  accent?: string;
  /**
   * Individual page-edge colors. Supply between 2 and 6 values. The logo
   * remains readable with a single repeated color.
   */
  pageColors?: readonly string[];
  /** Reduces page detail for favicons and very small UI placements. */
  detail?: BlackBookLogoDetail;
  /** Optional line beneath the wordmark. */
  tagline?: string;
  /** Accessible label for the complete logo. */
  label?: string;
  /** Rounded-corner radius (percent) used by the app-icon variant. */
  iconRadius?: number;
}

interface BlackBookMarkProps {
  ink: string;
  paper: string;
  accent: string;
  pageColors: readonly string[];
  detail: BlackBookLogoDetail;
}

const DEFAULT_PAGE_COLORS = [
  brandPalette.archivePaper,
  brandPalette.pageSand,
  brandPalette.archivePaper,
  brandPalette.copperInk,
] as const;

/**
 * Custom Black Book symbol.
 *
 * The left volume is the book cover. The curved vertical bands are exposed
 * page edges. The right volume forms a proprietary asymmetric B. The
 * location pin is integrated into the cover.
 */
export function BlackBookMark({
  ink,
  paper,
  accent,
  pageColors,
  detail,
}: BlackBookMarkProps): React.JSX.Element {
  const requestedPages =
    detail === 'compact'
      ? pageColors.slice(0, Math.min(2, pageColors.length))
      : pageColors.slice(0, Math.min(6, pageColors.length));

  const colors =
    requestedPages.length >= 2
      ? requestedPages
      : DEFAULT_PAGE_COLORS.slice(0, detail === 'compact' ? 2 : 4);

  const baseWidths = detail === 'compact' ? [9, 6] : [8, 5, 5, 3, 3, 2];

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 360 360"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      {/* Closed front cover. Its curved inner edge creates the book silhouette. */}
      <path fill={ink} d="M54 58H110c16 0 27 6 39 19v206c-12 13-23 19-39 19H54Z" />

      {/*
       * Custom B bowls. The lower bowl is deliberately larger and extends
       * farther right, which keeps the mark from reading like a stock glyph.
       */}
      <path
        fill={ink}
        fillRule="evenodd"
        d={[
          'M150 58H222',
          'c44 0 72 24 72 60',
          '0 26-14 46-40 57',
          '32 10 51 34 51 66',
          '0 38-25 61-56 61',
          'H150V58Z',
          'M180 96V154H222',
          'c18 0 29-11 29-29',
          's-11-29-29-29H180Z',
          'M180 204V266H229',
          'c20 0 33-12 33-31',
          's-13-31-33-31H180Z',
        ].join(' ')}
      />

      {/* Parametric page bands. */}
      <g fill="none" strokeLinecap="butt">
        {colors.map((color, index) => {
          const startX = 112 + index * 8;
          const curveX = startX + 20;
          const spineX = startX + 36;
          const width = baseWidths[index] ?? 2;

          return (
            <path
              key={`${color}-${index}`}
              d={[
                `M${startX} 58`,
                `C${curveX} 58 ${spineX} 74 ${spineX} 94`,
                'V266',
                `c0 20-16 36-36 36`,
              ].join(' ')}
              stroke={color}
              strokeWidth={width}
            />
          );
        })}
      </g>

      {/* Place marker. */}
      <path
        fill={accent}
        fillRule="evenodd"
        d={[
          'M82 245',
          'c-12 0-22 10-22 22',
          '0 18 22 41 22 41',
          's22-23 22-41',
          'c0-12-10-22-22-22Z',
          'm0 13',
          'a9 9 0 1 1 0 18',
          'a9 9 0 0 1 0-18Z',
        ].join(' ')}
      />
      <circle cx="82" cy="267" r="6" fill={paper} />
    </svg>
  );
}

export function BlackBookLogo({
  variant = 'horizontal',
  size = 112,
  ink = brandPalette.blackInk,
  paper = brandPalette.archivePaper,
  accent = brandPalette.copperPin,
  pageColors = DEFAULT_PAGE_COLORS,
  detail = 'full',
  tagline,
  label = 'Black Book',
  iconRadius = 26,
  className,
  style,
  ...divProps
}: BlackBookLogoProps): React.JSX.Element {
  const isSymbolOnly = variant === 'mark' || variant === 'app-icon';

  const rootStyle = {
    '--bb-logo-size': `${size}px`,
    '--bb-logo-ink': ink,
    '--bb-logo-paper': paper,
    '--bb-logo-accent': accent,
    ...style,
  } as React.CSSProperties;

  const mark = (
    <span className="bb-logo__mark" aria-hidden="true">
      <BlackBookMark ink={ink} paper={paper} accent={accent} pageColors={pageColors} detail={detail} />
    </span>
  );

  if (variant === 'app-icon') {
    return (
      <div
        {...divProps}
        className={['bb-logo', 'bb-logo--app-icon', className].filter(Boolean).join(' ')}
        style={{ ...rootStyle, borderRadius: `${iconRadius}%`, background: paper }}
        role="img"
        aria-label={label}
      >
        {mark}
      </div>
    );
  }

  return (
    <div
      {...divProps}
      className={['bb-logo', `bb-logo--${variant}`, className].filter(Boolean).join(' ')}
      style={rootStyle}
      role="img"
      aria-label={label}
    >
      {mark}

      {!isSymbolOnly && (
        <span className="bb-logo__copy" aria-hidden="true">
          <span className="bb-logo__wordmark">BLACK BOOK</span>
          {tagline ? <span className="bb-logo__tagline">{tagline}</span> : null}
        </span>
      )}
    </div>
  );
}
