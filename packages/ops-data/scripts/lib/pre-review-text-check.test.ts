import assert from 'node:assert/strict';
import test from 'node:test';
import { preReviewTextCheck } from './pre-review-text-check.ts';

test('clean text passes with no problems or warnings', () => {
  assert.deepEqual(
    preReviewTextCheck({
      displayName: 'Seattle Medium',
      summary: 'It first published in January 1970. A 2009 profile said his son ran it.',
    }),
    { problems: [], warnings: [] },
  );
});

test('a lowercase display name holds the record', () => {
  const { problems } = preReviewTextCheck({ displayName: 'segregation academy', summary: 'Text.' });
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /lowercase/u);
});

test('a month in a field with no year, an em dash and "now" warn without holding', () => {
  const { problems, warnings } = preReviewTextCheck({
    displayName: 'The Black Wall Street Times',
    summary: 'The outlet, which launched in June, covers Greenwood — and runs now.',
  });
  assert.deepEqual(problems, []);
  assert.equal(warnings.length, 3);
});

test('a month is not flagged when the field names a year, and "may" as a verb is not a month', () => {
  const { warnings } = preReviewTextCheck({
    displayName: 'Selma to Montgomery marches',
    summary: 'The marches took place in 1965, on March 7 and March 21. Records may be incomplete.',
  });
  assert.deepEqual(warnings, []);
});

test('a sentence about what the evidence lacks warns', () => {
  const { problems, warnings } = preReviewTextCheck({
    displayName: 'Odd Fellows Cemetery',
    summary: "The cemetery opened in 1870. The evidence doesn't say who is buried there.",
  });
  assert.deepEqual(problems, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /evidence itself/u);
});
