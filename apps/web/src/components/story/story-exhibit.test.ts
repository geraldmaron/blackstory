import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frontSafeCover } from '../../lib/stories/cover-safety';
import { isQuietImage, storyImageBasis, storyImageId, storyImageKind } from './story-exhibit';

const image = (alt: string, credit: string, url = 'https://example.org/a/File_%281%29.jpg') => ({
  url,
  alt,
  credit,
  rightsStatus: 'public_domain' as const,
});

test('kind is read from the words and left unsaid for a painting', () => {
  assert.equal(storyImageKind(image('A photographic portrait of Dred Scott', 'LOC')), 'photograph');
  assert.equal(storyImageKind(image('A 1937 residential security map', 'HOLC')), 'document');
  assert.equal(storyImageKind(image('Full-length painted portrait', 'Gilbert Stuart')), undefined);
  assert.equal(storyImageKind(image('A man at a desk', 'Wikimedia Commons')), undefined);
});

test('the date line says only whether the credit states a date', () => {
  assert.equal(storyImageBasis(image('x', 'Photograph, circa 1857.')), 'date in the credit');
  assert.equal(storyImageBasis(image('x', 'Wikimedia Commons')), 'date not on record');
});

test('an image of a massacre is quiet', () => {
  assert.equal(isQuietImage(image('A postcard', 'Tulsa Race Massacre postcard, 1921')), true);
  assert.equal(
    isQuietImage(image('The first page of the Constitution', 'National Archives')),
    false,
  );
});

test('the address comes from the stored file name, not from position', () => {
  assert.equal(storyImageId(image('x', 'y')), 'image-file-1');
});

test('a cover is hidden on a front page unless its story is listed as safe', () => {
  const hero = image('x', 'y');
  assert.equal(frontSafeCover({ slug: 'the-count', heroImage: hero }), hero);
  assert.equal(frontSafeCover({ slug: 'the-gap-that-never-closed', heroImage: hero }), undefined);
  assert.equal(frontSafeCover({ slug: 'a-story-published-next-year', heroImage: hero }), undefined);
  assert.equal(
    frontSafeCover({
      slug: 'abraham-lincoln',
      heroImage: hero,
      collection: { id: 'presidents', label: 'Presidents', position: 16 },
    }),
    hero,
  );
});
