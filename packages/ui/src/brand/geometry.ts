/**
 * Pure layout math for the Black Book brand mark. Shared by the React
 * component and the static-asset generator so every rendering of the mark
 * comes from one construction grid.
 */
import { GLYPH_COLUMNS, GLYPH_ROWS, glyphBCells, type GlyphCell } from './glyph.js';

export type MarkGeometryOptions = {
  readonly cellSize?: number;
  readonly gutter?: number;
  readonly letterGap?: number;
  readonly padding?: number;
};

const DEFAULT_CELL_SIZE = 28;
const DEFAULT_GUTTER = 4;
const DEFAULT_LETTER_GAP = 48;
const DEFAULT_PADDING = 16;

export type LayoutBlock = {
  readonly cellIndex: number;
  readonly x: number;
  readonly y: number;
  readonly size: number;
};

export type GlyphLayout = {
  readonly width: number;
  readonly height: number;
  readonly blocks: readonly LayoutBlock[];
};

function layoutCells(
  cells: readonly GlyphCell[],
  cellSize: number,
  gutter: number,
  originX: number,
  originY: number,
): LayoutBlock[] {
  const pitch = cellSize + gutter;
  return cells.map((cell, cellIndex) => ({
    cellIndex,
    x: originX + cell.col * pitch,
    y: originY + cell.row * pitch,
    size: cellSize,
  }));
}

function glyphExtent(cellSize: number, gutter: number) {
  return {
    width: GLYPH_COLUMNS * cellSize + (GLYPH_COLUMNS - 1) * gutter,
    height: GLYPH_ROWS * cellSize + (GLYPH_ROWS - 1) * gutter,
  };
}

/** Lays out a single glyph — used standalone for the favicon mark. */
export function buildGlyphLayout(options: MarkGeometryOptions = {}): GlyphLayout {
  const cellSize = options.cellSize ?? DEFAULT_CELL_SIZE;
  const gutter = options.gutter ?? DEFAULT_GUTTER;
  const padding = options.padding ?? 0;
  const cells = glyphBCells();
  const blocks = layoutCells(cells, cellSize, gutter, padding, padding);
  const extent = glyphExtent(cellSize, gutter);
  return {
    width: extent.width + padding * 2,
    height: extent.height + padding * 2,
    blocks,
  };
}

export type MarkBlock = LayoutBlock & { readonly letter: 'first' | 'second' };

export type MarkLayout = {
  readonly width: number;
  readonly height: number;
  readonly blocks: readonly MarkBlock[];
};

/** Lays out the two-letter "BB" lockup used by the full-pigment / mono / reversed variants. */
export function buildMarkLayout(options: MarkGeometryOptions = {}): MarkLayout {
  const cellSize = options.cellSize ?? DEFAULT_CELL_SIZE;
  const gutter = options.gutter ?? DEFAULT_GUTTER;
  const letterGap = options.letterGap ?? DEFAULT_LETTER_GAP;
  const padding = options.padding ?? DEFAULT_PADDING;

  const cells = glyphBCells();
  const extent = glyphExtent(cellSize, gutter);

  const firstBlocks: MarkBlock[] = layoutCells(cells, cellSize, gutter, padding, padding).map(
    (block) => ({ ...block, letter: 'first' as const }),
  );
  const secondOriginX = padding + extent.width + letterGap;
  const secondBlocks: MarkBlock[] = layoutCells(
    cells,
    cellSize,
    gutter,
    secondOriginX,
    padding,
  ).map((block) => ({ ...block, letter: 'second' as const }));

  return {
    width: secondOriginX + extent.width + padding,
    height: extent.height + padding * 2,
    blocks: [...firstBlocks, ...secondBlocks],
  };
}

/** Centers a scaled mark within a wide social/OG frame, with headroom below for a wordmark. */
export function buildSocialLayout(
  frameWidth: number,
  frameHeight: number,
  markHeight: number,
  options: MarkGeometryOptions = {},
): MarkLayout & { readonly offsetX: number; readonly offsetY: number; readonly scale: number } {
  const base = buildMarkLayout(options);
  const scale = markHeight / base.height;
  const scaledWidth = base.width * scale;
  const offsetX = (frameWidth - scaledWidth) / 2;
  const offsetY = (frameHeight - markHeight) / 2 - frameHeight * 0.06;
  return { ...base, offsetX, offsetY, scale };
}
