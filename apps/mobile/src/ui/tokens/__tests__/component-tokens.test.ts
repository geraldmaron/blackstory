/**
 * Components take radius and color from the tokens (docs/ui/DESIGN.md section 7.4: radius is 0,
 * 8 or full; section 4 rule 3: no color the system does not have). A static scan, like
 * `retired-surfaces.test.ts`: a hard-coded corner or hex is cheap to add and invisible in review.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { radius } from '..';

const SRC = join(__dirname, '..', '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' || entry === 'generated' ? [] : sourceFiles(full);
    }
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const FILES = sourceFiles(SRC).map((path) => ({ name: relative(SRC, path), source: code(path) }));

/** Drawn marks, not component corners: the brand glyph shapes and the map legend's own dots. */
const DRAWN_MARKS = ['ui/EntityMark.tsx', 'features/explore/MapColorKey.tsx'];
/** The map's data palette and style are MapLibre paint, which cannot read a theme hook. */
const MAP_PAINT = /^features\/map\//;

describe('component tokens', () => {
  it('the radius scale is 0, 8 and full', () => {
    expect(radius).toEqual({ none: 0, sm: 8, full: 999 });
  });

  it('no component hard-codes a corner radius', () => {
    const offenders = FILES.filter(({ name }) => !DRAWN_MARKS.includes(name))
      .filter(({ source }) => /border\w*Radius:\s*[\d(]/.test(source))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it('no component hard-codes a color', () => {
    const offenders = FILES.filter(({ name }) => !MAP_PAINT.test(name))
      .filter(({ source }) => /['"`]#[0-9a-fA-F]{3,8}['"`]|rgba?\(/.test(source))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it('nothing imports glass, blur or a gradient', () => {
    const offenders = FILES.filter(({ source }) =>
      /expo-glass-effect|expo-blur|expo-linear-gradient|BlurView/.test(source),
    ).map(({ name }) => name);
    expect(offenders).toEqual([]);
  });
});
