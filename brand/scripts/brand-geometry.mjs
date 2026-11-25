/**
 * The BlackStory mark as numbers: the one definition every brand asset is built from.
 *
 * Nothing here is drawn by hand or stored as pixels. The symbol is four page shapes made of
 * straight lines and circular arcs plus a map pin; the wordmark is "BlackStory" set in Outfit Regular
 * (brand/fonts, SIL OFL) and converted to outlines. `build-kit.mjs` turns these
 * into the SVG masters and every exported file.
 *
 * The numbers were measured on the approved artwork (brand/source/generated-2026-07-18/approved-reference.png and the
 * 2048px symbol exports made from it), which was generated as an image and so had no geometry
 * or font of its own. Units are that artwork's own: a 2048 square for the symbol, 1672 by 941
 * for the lockup.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '../..');
const require = createRequire(resolve(ROOT, 'package.json'));
const opentype = require('opentype.js');

/** Brand colors of the mark. The cover and the letters take the theme's ink or paper. */
export const MARK_COLORS = {
  sand: '#E9BF85',
  copper: '#D68149',
  mahogany: '#861701',
  /** On a dark ground. */
  paper: '#F7F3EE',
  /** On a light ground. */
  ink: '#0C0C0C',
};

export const SYMBOL_SIZE = 2048;

/** Every page ends in a half circle whose center sits on this line. */
const FOOT_Y = 1295;

/**
 * A page of the book: a top edge rising to the left, a rounded top-right corner, a straight
 * right edge and a half-circle foot. `top` is a point on the top edge and its slope; `corner`
 * is the top-right corner's radius; `foot` is the half circle's radius; `right` the right edge.
 * `start` is where a back page's top edge first shows, left of which it is behind the others.
 */
const PAGES = [
  { name: 'cover', right: 1110, foot: 218, corner: 185, top: { x: 674, y: 385, slope: 0.36 } },
  {
    name: 'sand',
    right: 1209,
    foot: 224,
    corner: 190,
    top: { x: 860, y: 405.5, slope: 0.36 },
    start: 757,
  },
  {
    name: 'copper',
    right: 1301,
    foot: 207,
    corner: 182,
    top: { x: 860, y: 369, slope: 0.355 },
    start: 845,
  },
  {
    name: 'mahogany',
    right: 1394,
    foot: 193,
    corner: 177,
    top: { x: 910, y: 356, slope: 0.3525 },
    start: 900,
  },
];

/** The clear strip between one page and the page showing behind it, along the right edge and the foot. */
const PAGE_GAP = [39, 33, 35];
/**
 * The same strip along the top edges, measured straight up. It is narrower there than at the
 * side, and narrower for each page back: the tops fan closer together than the sides.
 */
const TOP_GAP = [36, 28, 25];

/** The pin on the cover: a round head with a round hole, tapering to a point. */
const PIN = { cx: 891.5, cy: 1205, head: 108.5, hole: 45, tipY: 1422 };

const n = (value) => +value.toFixed(2);

/**
 * A page's outline as the points and radii a path needs, grown outward by `grow` at the right
 * edge, the corner and the foot, and with its top edge raised by `lift`.
 */
function pageOutline(page, grow = 0, lift = 0) {
  const { slope } = page.top;
  const norm = Math.hypot(slope, 1);
  const lineY = (x) => page.top.y + slope * (x - page.top.x) - lift;
  const right = page.right + grow;
  const corner = page.corner + grow;
  const cornerX = page.right - page.corner;
  // The corner's center is `corner` from both the right edge and the top edge.
  const cornerY = lineY(cornerX) + corner * norm;
  // Where the top edge meets the corner: the foot of the perpendicular from the center.
  const tangent = { x: cornerX + (corner * slope) / norm, y: cornerY - corner / norm };
  const foot = page.foot + grow;
  const footX = page.right - page.foot;
  return { lineY, slope, right, corner, cornerY, tangent, foot, footX, left: footX - foot };
}

/** The cover: the whole page shape, with the pin's place left for the pin. */
function coverPath() {
  const o = pageOutline(PAGES[0]);
  return [
    `M${n(o.left)} ${n(o.lineY(o.left))}`,
    `L${n(o.tangent.x)} ${n(o.tangent.y)}`,
    `A${o.corner} ${o.corner} 0 0 1 ${o.right} ${n(o.cornerY)}`,
    `L${o.right} ${FOOT_Y}`,
    `A${o.foot} ${o.foot} 0 0 1 ${n(o.left)} ${FOOT_Y}`,
    'Z',
  ].join('');
}

/** Where two circles cross, taking the lower crossing. */
function lowerCrossing(a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const along = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const off = Math.sqrt(Math.max(0, a.r * a.r - along * along));
  const ux = (b.x - a.x) / d;
  const uy = (b.y - a.y) / d;
  const px = a.x + along * ux;
  const py = a.y + along * uy;
  const one = { x: px - off * uy, y: py + off * ux };
  const two = { x: px + off * uy, y: py - off * ux };
  return one.y > two.y ? one : two;
}

/**
 * The part of a page that shows past the page in front of it: its own outline on the outside,
 * and the front page's outline grown by the gap on the inside. Both are lines and arcs.
 */
function bandPath(index) {
  const outer = pageOutline(PAGES[index]);
  const inner = pageOutline(PAGES[index - 1], PAGE_GAP[index - 1], TOP_GAP[index - 1]);
  // The band's top-left end, where its top edge first shows. The band has to have some
  // thickness there and at the corner, or its outline would cross itself and fill the strip
  // that is meant to stay clear.
  const tipX = PAGES[index].start;
  const tip = { x: tipX, y: outer.lineY(tipX) };
  const tipInner = { x: tipX, y: inner.lineY(tipX) };
  for (const x of [tipX, inner.tangent.x]) {
    if (inner.lineY(x) - outer.lineY(x) <= 0) {
      throw new Error(
        `The ${PAGES[index].name} page does not clear the page in front of it at x ${x}`,
      );
    }
  }
  // Its heel, bottom: where the two feet cross.
  const heel = lowerCrossing(
    { x: outer.footX, y: FOOT_Y, r: outer.foot },
    { x: inner.footX, y: FOOT_Y, r: inner.foot },
  );
  return [
    `M${n(tip.x)} ${n(tip.y)}`,
    `L${n(outer.tangent.x)} ${n(outer.tangent.y)}`,
    `A${outer.corner} ${outer.corner} 0 0 1 ${outer.right} ${n(outer.cornerY)}`,
    `L${outer.right} ${FOOT_Y}`,
    `A${outer.foot} ${outer.foot} 0 0 1 ${n(heel.x)} ${n(heel.y)}`,
    `A${inner.foot} ${inner.foot} 0 0 0 ${inner.right} ${FOOT_Y}`,
    `L${inner.right} ${n(inner.cornerY)}`,
    `A${inner.corner} ${inner.corner} 0 0 0 ${n(inner.tangent.x)} ${n(inner.tangent.y)}`,
    `L${n(tipInner.x)} ${n(tipInner.y)}`,
    'Z',
  ].join('');
}

/** The pin: the head's circle, two tangents down to the tip, and the hole. */
function pinPath() {
  const { cx, cy, head, hole, tipY } = PIN;
  const drop = tipY - cy;
  // The tangent points from the tip to the head.
  const angle = Math.acos(head / drop);
  const tx = head * Math.sin(angle);
  const ty = head * Math.cos(angle);
  return [
    `M${n(cx)} ${tipY}`,
    `L${n(cx - tx)} ${n(cy + ty)}`,
    `A${head} ${head} 0 1 1 ${n(cx + tx)} ${n(cy + ty)}`,
    'Z',
    // The hole runs the other way round, so it is cut out under either fill rule.
    `M${n(cx - hole)} ${cy}`,
    `A${hole} ${hole} 0 1 0 ${n(cx + hole)} ${cy}`,
    `A${hole} ${hole} 0 1 0 ${n(cx - hole)} ${cy}`,
    'Z',
  ].join('');
}

/** The symbol's five shapes, back to front, in symbol units. `theme` is the ground it sits on. */
export function symbolShapes(theme) {
  return [
    { id: 'page-mahogany', d: bandPath(3), fill: MARK_COLORS.mahogany },
    { id: 'page-copper', d: bandPath(2), fill: MARK_COLORS.copper },
    { id: 'page-sand', d: bandPath(1), fill: MARK_COLORS.sand },
    { id: 'cover', d: coverPath(), fill: theme === 'dark' ? MARK_COLORS.paper : MARK_COLORS.ink },
    { id: 'pin', d: pinPath(), fill: MARK_COLORS.copper },
  ];
}

/** The symbol's ink box in symbol units, for clear space and for fitting it into a tile. */
export const SYMBOL_BOX = (() => {
  const cover = pageOutline(PAGES[0]);
  const tops = PAGES.map((page) => pageOutline(page).lineY(page.start ?? cover.left));
  return {
    left: cover.left,
    right: PAGES[3].right,
    top: Math.min(...tops),
    bottom: FOOT_Y + Math.max(...PAGES.map((page) => page.foot)),
  };
})();

/** The pin's width: one X of clear space (docs/ui/brand.md). */
export const PIN_WIDTH = PIN.head * 2;

/** The symbol as one flat silhouette with the pin cut out, for single-color uses. */
export function symbolSilhouette() {
  const pin = pinPath();
  const hole = pin.slice(pin.indexOf('Z') + 1);
  const outer = pin.slice(0, pin.indexOf('Z') + 1);
  return {
    // Even-odd: the pin is cut from the cover and its hole is filled back in.
    solid: [bandPath(3), bandPath(2), bandPath(1)].join(''),
    cover: coverPath() + outer + hole,
  };
}

// —— The wordmark ————————————————————————————————————————————————————————————

/**
 * "BlackStory" in Outfit Regular with the font's own kerning. `tracking` is in ems and `size` is
 * the em in lockup units. Outfit was chosen by measurement: of 33 open faces fitted to the
 * approved artwork's letters it is the closest with the artwork's one-storey "a", and its
 * capital and lowercase heights are the artwork's (155 and 106 units at this size). The
 * tracking is a little looser than the artwork's, so no letters touch; the word is 1.5 percent
 * wider. The letters
 * start at x 525 and stand on the baseline at 562. It is also the site's display face, so the
 * wordmark and every headline are one typeface.
 */
export const WORDMARK = {
  text: 'BlackStory',
  fontFile: 'brand/fonts/Outfit-Regular.ttf',
  family: 'Outfit',
  weight: 400,
  /** Glyph swaps, if the wordmark ever needs one of the font's alternates. None today. */
  alternates: {},
  tracking: -0.03,
  size: 223.3,
  left: 525,
  baseline: 562,
};

export const LOCKUP_SIZE = { width: 1672, height: 941 };

/** Where the symbol sits in the lockup: its 2048 square scaled and moved. */
export const LOCKUP_SYMBOL = { scale: 0.3034, x: 35.5, y: 177 };

/** opentype.js's own `toPathData` writes NaN for some rounded values, so this writes the path. */
function pathData(path) {
  return path.commands
    .map((c) => {
      if (c.type === 'M' || c.type === 'L') return `${c.type}${n(c.x)} ${n(c.y)}`;
      if (c.type === 'Q') return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
      if (c.type === 'C') return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
      return 'Z';
    })
    .join('');
}

/** The wordmark's glyphs in order, with the alternates swapped in. */
function wordmarkGlyphs(font) {
  const named = new Map();
  for (let i = 0; i < font.glyphs.length; i += 1)
    named.set(font.glyphs.get(i).name, font.glyphs.get(i));
  // One glyph a letter: the library's own shaping fails on some fonts' substitution tables, and
  // this word needs none.
  return [...WORDMARK.text].map((letter) => {
    const glyph = font.charToGlyph(letter);
    const alternate = WORDMARK.alternates[glyph.name];
    if (!alternate) return glyph;
    const swapped = named.get(alternate);
    if (!swapped) throw new Error(`The wordmark font has no glyph ${alternate}`);
    return swapped;
  });
}

/**
 * The wordmark as one outlined path in lockup units, with its ink box. The letters are laid out
 * here (advance, kerning, tracking) so the alternates take part in the spacing.
 */
export function wordmarkPath() {
  const font = opentype.parse(readFileSync(resolve(ROOT, WORDMARK.fontFile)).buffer);
  const em = font.unitsPerEm;
  const glyphs = wordmarkGlyphs(font);
  const { size, tracking } = WORDMARK;
  // Placed by its ink, not its side bearing: the "B" starts exactly at `left`.
  let x = WORDMARK.left - (glyphs[0].getBoundingBox().x1 / em) * size;
  const commands = [];
  let ink = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  glyphs.forEach((glyph, i) => {
    const path = glyph.getPath(x, WORDMARK.baseline, size);
    commands.push(pathData(path));
    const box = path.getBoundingBox();
    ink = {
      left: Math.min(ink.left, box.x1),
      right: Math.max(ink.right, box.x2),
      top: Math.min(ink.top, box.y1),
      bottom: Math.max(ink.bottom, box.y2),
    };
    const next = glyphs[i + 1];
    const kerning = next ? font.getKerningValue(glyph, next) || 0 : 0;
    x += ((glyph.advanceWidth + kerning) / em + tracking) * size;
  });
  return { d: commands.join(''), ink };
}

/**
 * What a page needs to set the wordmark as live text and stand the symbol beside it, in ems of
 * the text: the tracking, how far the "B"'s ink sits inside its box, where the baseline falls in
 * a line of height 1, and the symbol's square relative to the ink's left edge and the baseline.
 */
export function liveLockupMetrics() {
  const font = opentype.parse(readFileSync(resolve(ROOT, WORDMARK.fontFile)).buffer);
  const em = font.unitsPerEm;
  const ascent = font.tables.hhea.ascender / em;
  const descent = -font.tables.hhea.descender / em;
  const side = font.charToGlyph('B').getBoundingBox().x1 / em;
  const s = LOCKUP_SYMBOL;
  const size = WORDMARK.size;
  return {
    family: WORDMARK.family,
    weight: WORDMARK.weight,
    tracking: WORDMARK.tracking,
    sideBearing: +side.toFixed(4),
    baseline: +((1 - (ascent + descent)) / 2 + ascent).toFixed(4),
    symbol: {
      size: +((SYMBOL_SIZE * s.scale) / size).toFixed(4),
      left: +((s.x - WORDMARK.left) / size).toFixed(4),
      top: +((s.y - WORDMARK.baseline) / size).toFixed(4),
      inkLeft: +((s.x + SYMBOL_BOX.left * s.scale - WORDMARK.left) / size).toFixed(4),
    },
    wordWidth: +((wordmarkPath().ink.right - WORDMARK.left) / size).toFixed(4),
  };
}

// —— The masters as SVG ——————————————————————————————————————————————————————

const shapesMarkup = (theme) =>
  symbolShapes(theme)
    .map((shape) => `<path id="${shape.id}" d="${shape.d}" fill="${shape.fill}"/>`)
    .join('');

const SVG_HEAD = 'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="BlackStory"';

/** The symbol on its 2048 square. */
export function symbolSvg(theme) {
  return `<svg ${SVG_HEAD} viewBox="0 0 ${SYMBOL_SIZE} ${SYMBOL_SIZE}">${shapesMarkup(theme)}</svg>\n`;
}

/** The lockup: the symbol and the outlined wordmark, on the 1672 by 941 canvas. */
export function lockupSvg(theme) {
  const { width, height } = LOCKUP_SIZE;
  const letters = theme === 'dark' ? MARK_COLORS.paper : MARK_COLORS.ink;
  const s = LOCKUP_SYMBOL;
  return (
    `<svg ${SVG_HEAD} viewBox="0 0 ${width} ${height}">` +
    `<g id="symbol" transform="translate(${s.x} ${s.y}) scale(${s.scale})">${shapesMarkup(theme)}</g>` +
    `<path id="wordmark" d="${wordmarkPath().d}" fill="${letters}"/>` +
    `</svg>\n`
  );
}
