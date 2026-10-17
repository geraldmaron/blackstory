/**
 * Design-system lint for src/design (the kit). Components may use theme roles and scale tokens only:
 *
 *   color-literal     #hex, rgb(), hsl() in a component
 *   number-literal    a numeric size/space/radius/line prop above 2 (`padding={12}`, `minHeight={44}`); use `$4`, `$touch`
 *   unit-literal      '13px', '1.25rem' strings; use a token
 *   tag-prop          `tag="header"` (Tamagui 2 uses `render="header"`; `tag` silently renders a <div tag=..>)
 *   inline-style      `style={{ ... }}`; use props that resolve to tokens
 *
 * 0, 1 and 2 are allowed (zero, hairline, strong hairline). A line can opt out with
 * `// design-lint-allow: <reason>`; the reason is required and shows up in review.
 * Skipped: generated/, tokens.ts, config.ts, testing.tsx (they define the values).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN = join(ROOT, 'src/design');
const SKIP = new Set(['tokens.ts', 'config.ts', 'testing.tsx']);
const NUMERIC_PROPS =
  'fontSize|lineHeight|letterSpacing|padding\\w*|margin\\w*|gap|rowGap|columnGap|width|height|min(?:Width|Height)|max(?:Width|Height)|top|left|right|bottom|border(?:\\w*)Radius|borderRadius|size';
const NUMBER_PROP = new RegExp(
  `\\b(${NUMERIC_PROPS})\\s*[=:]\\s*\\{?\\s*(-?\\d+(?:\\.\\d+)?)\\b(?!\\s*[%\\w])`,
  'g',
);

export function lintSource(source, file = 'component.tsx') {
  const found = [];
  const lines = source.split('\n');
  let inBlockComment = false;
  lines.forEach((raw, index) => {
    let line = raw;
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end === -1) return;
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    line = line.replace(/\/\*.*?\*\//g, '');
    const open = line.indexOf('/*');
    if (open !== -1) {
      line = line.slice(0, open);
      inBlockComment = true;
    }
    if (/design-lint-allow:\s*\S/.test(raw)) return;
    const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
    const hit = (rule, text) => found.push({ file, line: index + 1, rule, text: text.trim() });
    if (/#[0-9a-fA-F]{3,8}\b/.test(code) || /\b(?:rgba?|hsla?)\(/.test(code))
      hit('color-literal', raw);
    for (const m of code.matchAll(NUMBER_PROP)) {
      if (!['0', '1', '2'].includes(m[2])) hit('number-literal', raw);
    }
    if (/['"`]-?\d+(?:\.\d+)?(?:px|rem|em)['"`]/.test(code) && !/['"`]1px['"`]/.test(code))
      hit('unit-literal', raw);
    if (/\btag=/.test(code)) hit('tag-prop', raw);
    if (/\bstyle=\{\{/.test(code)) hit('inline-style', raw);
  });
  return found;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'generated') walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !SKIP.has(entry)) out.push(full);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = walk(DESIGN).flatMap((file) =>
    lintSource(readFileSync(file, 'utf8'), relative(ROOT, file)),
  );
  if (problems.length > 0) {
    console.error('design lint: components must use theme roles and scale tokens\n');
    for (const p of problems) console.error(`${p.rule.padEnd(15)} ${p.file}:${p.line}  ${p.text}`);
    console.error(
      '\nSee src/design/README.md. Opt out per line with `// design-lint-allow: <reason>`.',
    );
    process.exit(1);
  }
  console.log(`design lint ok (${walk(DESIGN).length} files)`);
}
