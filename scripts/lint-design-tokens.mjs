/**
 * Design-token ratchet for CSS.
 *
 * Rules (standards come from packages/ui/src/tokens, not from this file):
 *   hex          raw #rgb/#rrggbb outside the token definition file; use a color token.
 *   spacing      padding/margin/gap length other than 0, 1px or 2px; use var(--ds-space-*).
 *   font-size    literal font-size; use var(--ds-text-*).
 *   breakpoint   @media min/max-width off the grid (grid.breakpoints: 40/48/64/80rem).
 *
 * Existing violations are recorded per file in scripts/design-token-baseline.json. The check
 * fails when a file's count for a rule rises above its baseline (or a new file has any), so
 * the debt can only fall. `--update` rewrites the baseline and refuses to raise a count unless
 * `--allow-increase` is also given.
 *
 *   node scripts/lint-design-tokens.mjs            check
 *   node scripts/lint-design-tokens.mjs --update   lower the baseline after paying debt down
 *   node scripts/lint-design-tokens.mjs --report   print totals by rule and the worst files
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'design-token-baseline.json');
const SCAN_ROOTS = ['apps/web/src', 'packages/ui/src/styles'];
/** Files that DEFINE tokens: raw values are the point there. */
const TOKEN_FILES = new Set(['packages/ui/src/styles/tokens.css']);

/** grid.breakpoints in packages/ui/src/tokens/spacing.ts, in px. */
const BREAKPOINTS_PX = [640, 768, 1024, 1280];
const SPACING_ALLOWED_PX = new Set([0, 1, 2]);
const SPACING_PROPERTY =
  /^(padding|margin|gap|row-gap|column-gap)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/;

const RULES = ['hex', 'spacing', 'font-size', 'breakpoint'];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.css')) out.push(full);
  }
  return out;
}

function toPx(value, unit) {
  const n = Number(value);
  if (unit === 'px') return n;
  if (unit === 'rem' || unit === 'em') return n * 16;
  return null;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function breakpointOnGrid(px) {
  // max-width queries conventionally sit 1px (or 0.02px) under the next min-width.
  return BREAKPOINTS_PX.some((bp) => px === bp || (px < bp && bp - px <= 1));
}

/** Returns [{rule, line, text}] for one CSS file. */
function scanFile(file, rel) {
  const isTokenFile = TOKEN_FILES.has(rel);
  const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
  const found = [];
  lines.forEach((raw, index) => {
    const line = index + 1;
    const text = raw.trim();
    if (!text) return;

    const media = text.match(/^@media\b(.*)/);
    if (media) {
      for (const m of media[1].matchAll(/(?:min|max)-width:\s*([\d.]+)(px|rem|em)/g)) {
        const px = toPx(m[1], m[2]);
        if (px !== null && !breakpointOnGrid(px)) found.push({ rule: 'breakpoint', line, text });
      }
      return;
    }

    // Split `a{b:c;d:e}` style lines so compact CSS cannot hide a declaration.
    for (const segment of text.split(/[{};]/)) {
      const decl = segment.trim().match(/^([a-z-]+)\s*:\s*(.+)$/i);
      if (!decl) continue;
      const [, property, value] = decl;
      const isCustomProperty = property.startsWith('--');

      if (!isTokenFile && /#[0-9a-f]{3,8}\b/i.test(value)) found.push({ rule: 'hex', line, text });

      if (isCustomProperty || isTokenFile) continue;

      if (property === 'font-size' && /^[\d.]+(px|rem|em)\b/.test(value)) {
        found.push({ rule: 'font-size', line, text });
      }

      if (SPACING_PROPERTY.test(property)) {
        // Lengths inside var()/calc() fallbacks are token-mediated; only bare literals count.
        const bare = value.replace(
          /var\([^)]*\)|calc\([^)]*\)|clamp\([^)]*\)|min\([^)]*\)|max\([^)]*\)/g,
          '',
        );
        for (const m of bare.matchAll(/(-?[\d.]+)(px|rem|em)\b/g)) {
          const px = toPx(m[1], m[2]);
          if (px !== null && !SPACING_ALLOWED_PX.has(Math.abs(px))) {
            found.push({ rule: 'spacing', line, text });
            break;
          }
        }
      }
    }
  });
  return found;
}

function scanAll() {
  const result = {};
  const details = {};
  for (const scanRoot of SCAN_ROOTS) {
    for (const file of walk(join(ROOT, scanRoot))) {
      const rel = relative(ROOT, file);
      for (const hit of scanFile(file, rel)) {
        result[hit.rule] ??= {};
        result[hit.rule][rel] = (result[hit.rule][rel] ?? 0) + 1;
        (details[`${hit.rule}:${rel}`] ??= []).push(hit);
      }
    }
  }
  return { counts: result, details };
}

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return {};
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).counts ?? {};
}

function total(counts, rule) {
  return Object.values(counts[rule] ?? {}).reduce((a, b) => a + b, 0);
}

function sortedCounts(counts) {
  const out = {};
  for (const rule of RULES) {
    if (!counts[rule]) continue;
    out[rule] = Object.fromEntries(
      Object.entries(counts[rule]).sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  return out;
}

const args = new Set(process.argv.slice(2));
const { counts, details } = scanAll();
const baseline = readBaseline();

if (args.has('--report')) {
  for (const rule of RULES) {
    console.log(
      `${rule.padEnd(11)} ${String(total(counts, rule)).padStart(5)} in ${Object.keys(counts[rule] ?? {}).length} files`,
    );
    const worst = Object.entries(counts[rule] ?? {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
    for (const [file, n] of worst) console.log(`    ${String(n).padStart(4)}  ${file}`);
  }
  process.exit(0);
}

const raised = [];
const lowered = [];
for (const rule of RULES) {
  const files = new Set([...Object.keys(counts[rule] ?? {}), ...Object.keys(baseline[rule] ?? {})]);
  for (const file of files) {
    const now = counts[rule]?.[file] ?? 0;
    const was = baseline[rule]?.[file] ?? 0;
    if (now > was) raised.push({ rule, file, now, was });
    else if (now < was) lowered.push({ rule, file, now, was });
  }
}

if (args.has('--update')) {
  if (existsSync(BASELINE_PATH) && raised.length > 0 && !args.has('--allow-increase')) {
    console.error(
      'Refusing to raise the baseline. Fix these, or pass --allow-increase deliberately:',
    );
    for (const r of raised) console.error(`  ${r.rule} ${r.file}: ${r.was} -> ${r.now}`);
    process.exit(1);
  }
  const body = {
    note: 'Ratchet baseline for scripts/lint-design-tokens.mjs. Counts may only fall.',
    counts: sortedCounts(counts),
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(body, null, 2)}\n`);
  console.log(`baseline written: ${RULES.map((r) => `${r} ${total(counts, r)}`).join(', ')}`);
  process.exit(0);
}

if (raised.length > 0) {
  console.error('design-token lint: new violations above baseline\n');
  for (const { rule, file, now, was } of raised) {
    console.error(`${rule}  ${file}  ${was} -> ${now}`);
    for (const hit of details[`${rule}:${file}`] ?? [])
      console.error(`    ${file}:${hit.line}  ${hit.text}`);
  }
  console.error('\nUse a token from packages/ui/src/tokens (see docs/ui/brand.md).');
  process.exit(1);
}

const paid = lowered.reduce((sum, r) => sum + (r.was - r.now), 0);
console.log(
  `design-token lint ok: ${RULES.map((r) => `${r} ${total(counts, r)}`).join(', ')}` +
    (paid > 0 ? `; ${paid} below baseline, run with --update to lock it in` : ''),
);
