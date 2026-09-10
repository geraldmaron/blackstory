/**
 * The editorial numbered list's counter must never paint without the gutter that holds it.
 *
 * `.ds-qualify-list li::before` (app/shell.css) renders
 * `counter(ds-qualify, decimal-leading-zero)` at `position: absolute; left: 0`, and the base rule
 * reserves room for it with `padding-left: var(--ds-space-12)` on the `li`. Any context that
 * restyles the list with the `padding` SHORTHAND silently drops that gutter while leaving the
 * counter where it was, so the number paints on top of the row's own text.
 *
 * That shipped: the record room's status history read "Active — 1750, ongoing" with an orange
 * "01" laid over it. It survived review because a `::before` counter is invisible to both
 * `textContent` and `elementFromPoint` — every DOM probe of the region came back clean.
 *
 * The rule here: if a stylesheet re-declares padding on a `.ds-qualify-list` item, it must either
 * keep a left gutter or turn the counter off.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const webSrc = join(repoRoot, 'apps/web/src');

function listCssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { recursive: true }) as string[]) {
    const full = join(dir, entry);
    if (entry.endsWith('.css') && statSync(full).isFile()) out.push(full);
  }
  return out;
}

/** Every `<selector> { ... }` block whose selector targets a `.ds-qualify-list` list item. */
function qualifyListItemBlocks(css: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  const pattern = /([^{}]*\.ds-qualify-list[^{}]*)\{([^{}]*)\}/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(css)) !== null) {
    const selector = match[1]!.trim();
    if (!/\bli\b/u.test(selector)) continue;
    if (/::(before|after|marker)/u.test(selector)) continue;
    out.push({ selector, body: match[2]! });
  }
  return out;
}

test('a qualify-list item that redeclares padding keeps the counter gutter or drops the counter', () => {
  const offenders: string[] = [];
  for (const file of listCssFiles(webSrc)) {
    const css = readFileSync(file, 'utf8');
    for (const block of qualifyListItemBlocks(css)) {
      const padding = /(^|[;{\s])padding\s*:([^;]*)/u.exec(block.body);
      if (!padding) continue;
      const value = padding[2]!.trim();
      const parts = value.split(/\s+/u);
      // A 1- or 2-value shorthand sets the left padding from the first or second value; a 3- or
      // 4-value one from the fourth (or the second, for 3). Anything resolving to `0` is a gutter
      // the counter no longer has.
      const left = parts.length === 1 ? parts[0]! : parts.length >= 4 ? parts[3]! : parts[1]!;
      const hasGutter = left !== '0' && left !== '0px' && left !== '0rem';
      if (hasGutter) continue;

      // No gutter is fine as long as this stylesheet also turns the counter off for that context.
      const scope = block.selector.replace(/\s*>\s*/gu, ' ').split(/\s+/u)[0] ?? '';
      const disablesCounter = new RegExp(
        `${scope.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}[^{}]*\\.ds-qualify-list[^{}]*::before\\s*\\{[^{}]*content\\s*:\\s*none`,
        'u',
      ).test(css);
      if (!disablesCounter) {
        offenders.push(`${relative(repoRoot, file)}: ${block.selector}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these rules strip the counter gutter but leave the counter painting at left:0:\n  ${offenders.join('\n  ')}`,
  );
});
