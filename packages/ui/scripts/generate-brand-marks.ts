/**
 * Generates the static Black Book brand-mark SVG assets from the single
 * source-of-truth geometry/pigment/glyph modules. Re-run after any change
 * to src/brand/geometry.ts, src/brand/scatter-map.ts, or
 * src/tokens/pigment.ts:
 *
 *   pnpm --filter @black-book/ui generate:brand
 *
 * Output is committed to src/brand/assets/ — these are design-source files
 * (letterhead, print, email-signature-style contexts where CSS `currentColor`
 * isn't available), distinct from the in-app <BrandMark /> component and
 * from apps/web's Next-native app/icon.svg and app/opengraph-image.tsx.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGlyphLayout, buildMarkLayout, buildSocialLayout } from '../src/brand/geometry.ts';
import { PIGMENT_SCATTER_MAP } from '../src/brand/scatter-map.ts';
import { brandInk, pigmentScale } from '../src/tokens/pigment.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'src', 'brand', 'assets');

type Variant = 'full-pigment' | 'mono' | 'reversed';

function blockFill(variant: Variant, letter: 'first' | 'second', cellIndex: number): string {
  if (variant === 'mono') {
    return brandInk.solid;
  }
  if (letter === 'second') {
    return variant === 'reversed' ? brandInk.solidInverse : brandInk.solid;
  }
  const toneIndex = PIGMENT_SCATTER_MAP[cellIndex] ?? 0;
  return pigmentScale[toneIndex]?.hex ?? brandInk.solid;
}

function svgOpen(width: number, height: number, background?: string) {
  const bg = background ? `\n  <rect x="0" y="0" width="${width}" height="${height}" fill="${background}" />` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${bg}`;
}

function markSvg(variant: Variant, background?: string): string {
  const layout = buildMarkLayout();
  const rects = layout.blocks
    .map(
      (block) =>
        `  <rect x="${block.x}" y="${block.y}" width="${block.size}" height="${block.size}" fill="${blockFill(variant, block.letter, block.cellIndex)}" />`,
    )
    .join('\n');
  return `${svgOpen(layout.width, layout.height, background)}\n${rects}\n</svg>\n`;
}

function faviconSvg(): string {
  const layout = buildGlyphLayout({ gutter: 0 });
  const rects = layout.blocks
    .map(
      (block) =>
        `  <rect x="${block.x}" y="${block.y}" width="${block.size}" height="${block.size}" fill="${brandInk.solid}" />`,
    )
    .join('\n');
  return `${svgOpen(layout.width, layout.height)}\n${rects}\n</svg>\n`;
}

function socialOgSvg(): string {
  const frameWidth = 1200;
  const frameHeight = 630;
  const canvas = '#FFFFFF';
  const social = buildSocialLayout(frameWidth, frameHeight, 260);
  const rects = social.blocks
    .map((block) => {
      const x = social.offsetX + block.x * social.scale;
      const y = social.offsetY + block.y * social.scale;
      const size = block.size * social.scale;
      return `  <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" fill="${blockFill('full-pigment', block.letter, block.cellIndex)}" />`;
    })
    .join('\n');
  const wordmarkY = social.offsetY + 260 + 64;
  const wordmark = `  <text x="${frameWidth / 2}" y="${wordmarkY}" text-anchor="middle" font-family="'Source Sans 3', 'Segoe UI', system-ui, sans-serif" font-weight="700" font-size="30" letter-spacing="10" fill="${brandInk.solid}">BLACK BOOK</text>`;
  return `${svgOpen(frameWidth, frameHeight, canvas)}\n${rects}\n${wordmark}\n</svg>\n`;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const files: Record<string, string> = {
    'bb-mark-full-pigment.svg': markSvg('full-pigment'),
    'bb-mark-mono.svg': markSvg('mono'),
    'bb-mark-reversed.svg': markSvg('reversed', '#000000'),
    'bb-mark-favicon.svg': faviconSvg(),
    'bb-mark-social-og.svg': socialOgSvg(),
  };
  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(outDir, name), content, 'utf8');
    console.log(`wrote ${path.relative(root, path.join(outDir, name))}`);
  }
}

await main();
