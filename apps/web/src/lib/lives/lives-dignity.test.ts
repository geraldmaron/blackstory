/**
 * Dignity and juxtaposition guards for the Lives decade world surface.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { LIVES_WORLD_BEAT_FIXTURES } from './world-beat-fixtures';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../');

test('world beats never invite a composite you or crime heat framing', () => {
  for (const beat of LIVES_WORLD_BEAT_FIXTURES) {
    assert.doesNotMatch(beat.body, /\byou would have been\b/i);
    assert.doesNotMatch(beat.heading, /\byou\b/i);
    assert.doesNotMatch(beat.body, /\bcrime heat\b|\bhow dangerous\b/i);
    assert.doesNotMatch(beat.body, /—/);
  }
});

test('justice and health beats carry insufficient_evidence when they refuse a region cell', () => {
  const justice = LIVES_WORLD_BEAT_FIXTURES.find((beat) => beat.id === '1960-justice-offramp');
  const health = LIVES_WORLD_BEAT_FIXTURES.find((beat) => beat.id === '1960-health-nchs-offramp');
  const whiteRent = LIVES_WORLD_BEAT_FIXTURES.find(
    (beat) => beat.id === '1970-affordance-white-rent-gap',
  );
  assert.equal(justice?.gapState, 'insufficient_evidence');
  assert.equal(health?.gapState, 'insufficient_evidence');
  assert.equal(whiteRent?.gapState, 'insufficient_evidence');
  assert.deepEqual(whiteRent?.lenses, ['white']);
});

test('scene pattern and methodology name unit, derived income, and modeled affordance', () => {
  const pattern = readFileSync(path.join(repoRoot, 'docs/ui/patterns-lives-scene.md'), 'utf8');
  const method = readFileSync(
    path.join(repoRoot, 'docs/methodology/lives-across-decades.md'),
    'utf8',
  );
  assert.match(pattern, /unit/i);
  assert.match(method, /Unit of analysis/);
  assert.match(method, /Derived income/);
  assert.match(method, /Modeled affordance/);
  assert.match(method, /Forbidden/);
});

/**
 * A missing estimate is not zero. The decade bar once coerced `cell.estimate ?? 0` and drew a
 * minimum fill, so "Withheld", "Not published" and "Not yet counted" rendered as near-zero
 * measurements. The era strip places no mark for a missing estimate and says the absence in
 * words under the plot instead.
 */
test('the era strip never draws a missing estimate as a value', () => {
  const reader = readFileSync(
    path.join(repoRoot, 'apps/web/src/components/lives/LivesMilestoneExperience.tsx'),
    'utf8',
  );
  assert.doesNotMatch(
    reader,
    /livesBarShare\(\s*cell\.estimate\s*\?\?\s*0/,
    'a missing estimate must not be coerced to 0',
  );
  assert.match(
    reader,
    /cell\.estimate === undefined/,
    'the mark must branch on a missing estimate',
  );
  const strip = readFileSync(
    path.join(repoRoot, 'apps/web/src/components/lives/LivesEraScrubber.tsx'),
    'utf8',
  );
  assert.match(strip, /mark\.at === null \? null/, 'no mark is placed for a missing estimate');
  assert.match(strip, /lives-scrub__missing/, 'a missing estimate must be said in words');
  const css = readFileSync(path.join(repoRoot, 'apps/web/src/app/lives/lives.css'), 'utf8');
  assert.match(css, /\.lives-scrub__missing\s*\{/, 'the absence line must be styled');
});
