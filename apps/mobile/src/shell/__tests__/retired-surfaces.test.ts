/**
 * Static guards against the retired product surfaces reappearing in native code.
 *
 * Each of these existed as a destination and no longer does. They are cheap to reintroduce by
 * accident — a screen keeps its old title after its route is renamed, a `router.push` keeps an old
 * address — and expensive to notice, because nothing crashes: the tab bar says one thing and the
 * screen says another, which is exactly the state the Records tab shipped in until a device
 * screenshot caught it.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.test\.tsx?$/.test(entry) || full.includes('__tests__')) continue;
    out.push(full);
  }
  return out;
}

const FILES = sourceFiles(SRC);

/** Strip block and line comments: a comment recording why a surface was retired is not a use. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('retired native surfaces', () => {
  it('no screen renders a retired surface as its title', () => {
    // `title="History"` is the specific regression: the Records tab kept the search screen's old
    // masthead, so the tab bar and the screen disagreed about what the reader was looking at.
    const retiredTitles = ['History', 'Learn', 'Topics', 'Myths', 'Quick facts', 'Legal'];
    for (const file of FILES) {
      const source = code(file);
      for (const title of retiredTitles) {
        expect(source).not.toContain(`title="${title}"`);
        expect(source).not.toContain(`title={'${title}'}`);
      }
    }
  });

  it('nothing navigates to a retired route', () => {
    const retiredRoutes = ['/learn', '/topics', '/myths', '/facts', '/legal', '/chapters'];
    for (const file of FILES) {
      // The legacy catch-all and the normalization tables exist precisely to name these.
      if (file.includes('legacy') || file.endsWith('mobile-nav.ts') || file.endsWith('sections.ts')) {
        continue;
      }
      const source = code(file);
      for (const route of retiredRoutes) {
        expect(source).not.toContain(`router.push('${route}`);
        expect(source).not.toContain(`href="${route}`);
      }
    }
  });

  it('no user-facing copy carries a BlackBook remnant', () => {
    for (const file of FILES) {
      expect(code(file).toLowerCase()).not.toContain('blackbook');
    }
  });
});
