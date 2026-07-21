import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStoryRewrite } from './story-rewrite.ts';

const paragraph = 'A '.repeat(80).trim();

test('story rewrite validation requires a substantial expansion', () => {
  const issues = validateStoryRewrite(
    { body: [{ paragraphs: ['Original paragraph with enough words to count.'] }] },
    { body: [{ paragraphs: [paragraph] }] },
  );
  assert.ok(issues.some((issue) => issue.includes('at least four sections')));
  assert.ok(issues.some((issue) => issue.includes('minimum is 900')));
});

test('story rewrite validation accepts four-section long prose', () => {
  const sections = Array.from({ length: 4 }, (_, index) => ({
    heading: `Section ${index + 1}`,
    paragraphs: [paragraph, paragraph, paragraph],
  }));
  assert.deepEqual(
    validateStoryRewrite({ body: [{ paragraphs: [paragraph] }] }, { body: sections }),
    [],
  );
});
