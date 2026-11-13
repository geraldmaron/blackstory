import assert from 'node:assert/strict';
import { test } from 'node:test';
import { storyImageSrc } from './story-image';

const ORIGINAL = 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Doc_%28page_1%29.jpg';

test('snaps to a width Commons actually renders, doubled for dense screens', () => {
  assert.equal(
    storyImageSrc(ORIGINAL, 64, 3000),
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Doc_%28page_1%29.jpg/250px-Doc_%28page_1%29.jpg',
  );
  assert.match(storyImageSrc(ORIGINAL, 600, 3000), /\/1280px-/);
});

test('never asks Commons to upscale: the original when the stored file is not wider', () => {
  assert.equal(storyImageSrc(ORIGINAL, 600, 1000), ORIGINAL);
  assert.equal(storyImageSrc(ORIGINAL, 1152, 5000), ORIGINAL);
});

test('with no stored width, resizes only at small steps', () => {
  assert.match(storyImageSrc(ORIGINAL, 64), /\/250px-/);
  assert.equal(storyImageSrc(ORIGINAL, 560), ORIGINAL);
});

test('a non-Commons URL passes through', () => {
  const url = 'https://example.org/a.jpg';
  assert.equal(storyImageSrc(url, 64, 3000), url);
});
