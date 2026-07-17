/**
 * The Black Book brand mark: two blocky "B" letterforms on a shared
 * construction grid. The first letter carries the pigment scale (Monk Skin
 * Tone Scale-derived, diaspora range — never a per-person classification);
 * the second letter is the fixed brand ink. See docs/ui/brand.md for
 * construction, clearspace, and misuse rules.
 *
 * Variants: `full-pigment` (light canvas, solid-black second letter),
 * `reversed` (dark canvas, solid-white second letter, pigment unchanged),
 * `mono` (single `currentColor`, for stamped/small/single-color contexts).
 */
import type { CSSProperties } from 'react';
import { brandInk, pigmentScale } from '../tokens/pigment.js';
import { buildMarkLayout, type MarkGeometryOptions } from './geometry.js';
import { PIGMENT_SCATTER_MAP } from './scatter-map.js';

export type BrandMarkVariant = 'full-pigment' | 'mono' | 'reversed';

export type BrandMarkProps = MarkGeometryOptions & {
  readonly variant?: BrandMarkVariant;
  /** Rendered height in px; width follows the mark's fixed aspect ratio. */
  readonly size?: number;
  readonly title?: string;
  /** True when adjacent visible text already provides the accessible name (e.g. a wordmark lockup). */
  readonly decorative?: boolean;
  readonly className?: string;
  readonly style?: CSSProperties;
};

function blockFill(variant: BrandMarkVariant, letter: 'first' | 'second', cellIndex: number): string {
  if (variant === 'mono') {
    return 'currentColor';
  }
  if (letter === 'second') {
    return variant === 'reversed' ? brandInk.solidInverse : brandInk.solid;
  }
  const toneIndex = PIGMENT_SCATTER_MAP[cellIndex] ?? 0;
  return pigmentScale[toneIndex]?.hex ?? brandInk.solid;
}

export function BrandMark({
  variant = 'full-pigment',
  size = 40,
  title = 'Black Book',
  decorative = false,
  className,
  style,
  ...geometry
}: BrandMarkProps) {
  const layout = buildMarkLayout(geometry);
  const scale = size / layout.height;
  const a11yProps = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img' as const, 'aria-label': title };

  return (
    <svg
      {...a11yProps}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={Math.round(layout.width * scale)}
      height={size}
      className={className}
      style={style}
    >
      {decorative ? null : <title>{title}</title>}
      {layout.blocks.map((block) => (
        <rect
          key={`${block.letter}-${block.cellIndex}`}
          x={block.x}
          y={block.y}
          width={block.size}
          height={block.size}
          fill={blockFill(variant, block.letter, block.cellIndex)}
        />
      ))}
    </svg>
  );
}
