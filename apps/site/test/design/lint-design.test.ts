import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lintSource } from '../../scripts/lint-design.mjs';

const rules = (source: string) => lintSource(source).map((p: { rule: string }) => p.rule);

test('allowed: tokens, 0/1/2, comments, string content that is not a unit', () => {
  const ok = [
    '<XStack padding="$4" gap="$2" borderWidth={1} borderRadius="$sm" minHeight="$touch" />',
    '<Text fontSize="$caption" color="$inkMuted" />',
    'const a = { opacity: 0.55, flex: 1, zIndex: 3 }',
    '// padding={12} and #fff in a comment',
    '/* minHeight={44} */',
    ' * width: 300',
    "const label = 'Page 12 of 40'",
    'borderWidth: 2',
  ];
  for (const source of ok) assert.deepEqual(rules(source), [], source);
});

test('color literals', () => {
  for (const source of [
    'color="#fff"',
    "background: '#0A0A0A'",
    'bg="rgba(0,0,0,.5)"',
    'hsl(10 20% 30%)',
  ]) {
    assert.deepEqual(rules(source), ['color-literal'], source);
  }
});

test('number literals above 2 in size, space, radius and type props', () => {
  for (const source of [
    '<Box padding={12} />',
    'minHeight={44}',
    'gap: 8',
    'borderRadius={14}',
    'fontSize={13}',
    'paddingHorizontal: 16',
  ]) {
    assert.deepEqual(rules(source), ['number-literal'], source);
  }
  assert.deepEqual(rules('<Box width="100%" maxWidth={672} />'), ['number-literal']);
});

test('unit strings other than a 1px hairline', () => {
  assert.deepEqual(rules("const s = '13px'"), ['unit-literal']);
  assert.deepEqual(rules('const s = "1.25rem"'), ['unit-literal']);
  assert.deepEqual(rules("const s = '1px'"), []);
});

test('tag prop and inline style', () => {
  assert.deepEqual(rules('<XStack tag="header" />'), ['tag-prop']);
  assert.deepEqual(rules('<div style={{ color: "red" }} />'), ['inline-style']);
  assert.deepEqual(rules('<XStack render="header" />'), []);
});

test('an allow comment with a reason opts a line out; one without does not', () => {
  assert.deepEqual(
    rules('<Box minHeight={44} /> // design-lint-allow: matches the native tab bar height'),
    [],
  );
  assert.deepEqual(rules('<Box minHeight={44} /> // design-lint-allow:'), ['number-literal']);
});

test('the kit itself is clean', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const root = join(__dirname, '../../src/design');
  const problems: unknown[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== 'generated') walk(full);
      } else if (
        /\.tsx?$/.test(entry) &&
        !['tokens.ts', 'config.ts', 'testing.tsx'].includes(entry)
      )
        problems.push(...lintSource(readFileSync(full, 'utf8'), full));
    }
  };
  walk(root);
  assert.deepEqual(problems, []);
});
