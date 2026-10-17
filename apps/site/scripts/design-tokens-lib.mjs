/**
 * Reads the SHIPPED design tokens (packages/ui/src/styles/tokens.css) and returns them as plain data.
 *
 * Why the CSS and not packages/ui/src/tokens/colors.ts: the CSS is what readers actually see, and the two
 * disagree in 15 color values (light canvas, light raised surface, the whole confidence ramp) plus the medium
 * radius. The Tamagui theme must reproduce what ships, so it is built from the CSS; the disagreement is
 * reported by test/design/token-drift.test.ts and filed, not silently resolved here.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const TOKENS_CSS = join(HERE, '../../../packages/ui/src/styles/tokens.css');

const camel = (name) =>
  name.replace(/^--ds-/, '').replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

function declarations(body) {
  const out = {};
  for (const m of body.matchAll(/(--ds-[\w-]+)\s*:\s*([^;]+?)\s*;/g))
    out[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  return out;
}

/** Top-level rule blocks as {selector, body}, ignoring nested at-rules' bodies. */
function topLevelBlocks(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const blocks = [];
  let depth = 0;
  let start = 0;
  let selectorStart = 0;
  for (let i = 0; i < stripped.length; i += 1) {
    const ch = stripped[i];
    if (ch === '{') {
      if (depth === 0) {
        start = i + 1;
        blocks.push({ selector: stripped.slice(selectorStart, i).trim(), bodyStart: start });
      }
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        const block = blocks[blocks.length - 1];
        block.body = stripped.slice(block.bodyStart, i);
        selectorStart = i + 1;
      }
    }
  }
  return blocks.filter((b) => b.body !== undefined);
}

const isColor = (value) => /^#[0-9a-f]{3,8}$/i.test(value) || /^rgba?\(/i.test(value);
const remToPx = (value) => {
  const m = /^(-?[\d.]+)rem$/.exec(value);
  return m ? Math.round(Number(m[1]) * 16 * 100) / 100 : undefined;
};
const pxValue = (value) => {
  const m = /^(-?[\d.]+)px$/.exec(value);
  return m ? Number(m[1]) : undefined;
};
const msValue = (value) => {
  const m = /^(\d+)ms$/.exec(value);
  return m ? Number(m[1]) : undefined;
};

export function readDesignTokens(cssPath = TOKENS_CSS) {
  const css = readFileSync(cssPath, 'utf8');
  const blocks = topLevelBlocks(css);
  const light = blocks.find((b) => /\[data-theme='light'\]/.test(b.selector));
  const dark = blocks.find((b) => /\[data-theme='dark'\]/.test(b.selector));
  const root = blocks
    .filter((b) => b.selector === ':root')
    .sort(
      (a, b) => Object.keys(declarations(b.body)).length - Object.keys(declarations(a.body)).length,
    )[0];
  if (!light || !dark || !root)
    throw new Error('tokens.css: expected light, dark and a large :root block');

  const themes = { light: {}, dark: {} };
  const nonColor = { light: [], dark: [] };
  for (const [name, block] of [
    ['light', light],
    ['dark', dark],
  ]) {
    for (const [prop, value] of Object.entries(declarations(block.body))) {
      if (isColor(value)) themes[name][camel(prop)] = value.toLowerCase();
      else nonColor[name].push(prop);
    }
  }

  const rootDecl = declarations(root.body);
  const space = {};
  const radius = {};
  const fonts = {};
  const text = {};
  const tracking = {};
  const leading = {};
  const duration = {};
  const unparsed = [];
  for (const [prop, value] of Object.entries(rootDecl)) {
    const name = prop.replace(/^--ds-/, '');
    let m;
    if ((m = /^space-(\d+)$/.exec(name))) {
      const px = remToPx(value);
      if (px === undefined) unparsed.push(prop);
      else space[m[1]] = px;
    } else if ((m = /^radius-(\w+)$/.exec(name))) {
      const px = pxValue(value);
      if (px === undefined) unparsed.push(prop);
      else radius[m[1]] = px;
    } else if ((m = /^font-(\w+)$/.exec(name))) {
      fonts[m[1]] = value;
    } else if ((m = /^text-([\w-]+)$/.exec(name))) {
      const px = remToPx(value);
      const clampMin = /^clamp\(\s*([\d.]+rem)/.exec(value);
      text[
        camel(prop)
          .replace(/^text/, '')
          .replace(/^./, (c) => c.toLowerCase())
      ] = {
        css: value,
        px: px ?? (clampMin ? remToPx(clampMin[1]) : undefined),
        fluid: px === undefined,
      };
    } else if ((m = /^tracking-([\w-]+)$/.exec(name))) tracking[camel(m[1])] = value;
    else if ((m = /^leading-([\w-]+)$/.exec(name))) leading[camel(m[1])] = Number(value);
    else if ((m = /^duration-(\w+)$/.exec(name))) {
      const ms = msValue(value);
      if (ms === undefined) unparsed.push(prop);
      else duration[m[1]] = ms;
    }
  }
  const borderWidth = pxValue(rootDecl['--ds-border-width'] ?? '');
  const borderWidthStrong = pxValue(rootDecl['--ds-border-width-strong'] ?? '');
  const focusWidth = pxValue(rootDecl['--ds-focus-width'] ?? '');
  const focusOffset = pxValue(rootDecl['--ds-focus-offset'] ?? '');

  return {
    themes,
    space,
    radius,
    fonts,
    text,
    tracking,
    leading,
    duration,
    border: { width: borderWidth, widthStrong: borderWidthStrong },
    focus: { width: focusWidth, offset: focusOffset },
    meta: {
      nonColorThemeProps: nonColor,
      unparsed,
      sourceSha256: createHash('sha256').update(css).digest('hex'),
    },
  };
}

/** The exact text of src/design/generated/tokens.ts for a token set. */
export function renderTokensModule(tokens) {
  const { meta, ...data } = tokens;
  const json = (value) => JSON.stringify(value, null, 2);
  return `/**
 * GENERATED by scripts/generate-design-tokens.mjs from packages/ui/src/styles/tokens.css. Do not edit.
 * Run \`npm run design:tokens\` after changing the CSS; test/design/token-drift.test.ts fails when this file is stale.
 * Source sha256: ${meta.sourceSha256}
 */
${Object.entries(data)
  .map(([key, value]) => `export const ${key} = ${json(value)} as const;`)
  .join('\n\n')}

export const sourceSha256 = '${meta.sourceSha256}';
`;
}
