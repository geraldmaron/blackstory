import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPaletteSeed,
  sanitizePaletteSeed,
  setPaletteSeed,
  subscribeToPaletteSeed,
} from './palette-seed';

test('a mistyped path becomes the words the reader was reaching for', () => {
  assert.equal(sanitizePaletteSeed('/chapters/tulsa-race-masacre'), 'chapters tulsa race masacre');
  assert.equal(
    sanitizePaletteSeed('/entity/lynching_isaac_mcghie'),
    'entity lynching isaac mcghie',
  );
  assert.equal(sanitizePaletteSeed('/'), '');
});

test('query and fragment are dropped before the path is read', () => {
  assert.equal(sanitizePaletteSeed('/records?q=redlining#top'), 'records');
});

test('markup and quotes cannot survive into the search field', () => {
  // This is the reflected-content case the design law calls out: the seed is rendered into an
  // input `value` and posted to /search/api, so the whitelist has to drop these, not escape them.
  assert.equal(sanitizePaletteSeed('/<script>alert(1)</script>'), 'script alert 1 script');
  assert.equal(sanitizePaletteSeed('/x" onfocus="steal()'), 'x onfocus steal');
  assert.equal(sanitizePaletteSeed('/%3Cscript%3E'), 'script');
});

test('a malformed escape yields no seed rather than salvaged text', () => {
  assert.equal(sanitizePaletteSeed('/%E0%A4%A'), '');
});

test('the seed is capped and never ends mid-space', () => {
  const seed = sanitizePaletteSeed(`/${'a-'.repeat(200)}`);
  assert.ok(seed.length <= 64, `seed was ${seed.length} characters`);
  assert.equal(seed, seed.trim());
});

test('non-latin scripts are kept: the archive is searched in more than ascii', () => {
  assert.equal(sanitizePaletteSeed('/chapters/café-noir'), 'chapters café noir');
});

test('subscribers are notified on change and only on change', () => {
  setPaletteSeed('');
  let calls = 0;
  const unsubscribe = subscribeToPaletteSeed(() => {
    calls += 1;
  });

  setPaletteSeed('tulsa');
  assert.equal(getPaletteSeed(), 'tulsa');
  assert.equal(calls, 1);

  setPaletteSeed('tulsa');
  assert.equal(calls, 1, 'an identical seed must not remount the combobox');

  setPaletteSeed('');
  assert.equal(calls, 2);
  unsubscribe();

  setPaletteSeed('greenwood');
  assert.equal(calls, 2, 'unsubscribe must actually detach');
  setPaletteSeed('');
});
