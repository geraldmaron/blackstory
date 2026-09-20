import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatResultSummary } from './result-summary';

const records = { singular: 'record', plural: 'records' } as const;

describe('formatResultSummary', () => {
  it('prints the whole list as one number with a thousands separator', () => {
    assert.equal(formatResultSummary({ matched: 4218, total: 4218, ...records }), '4,218 records');
  });

  it('prints a narrowing as matched of total', () => {
    assert.equal(
      formatResultSummary({ matched: 37, total: 4218, ...records }),
      '37 of 4,218 records',
    );
  });

  it('agrees the noun with the number it follows', () => {
    assert.equal(formatResultSummary({ matched: 1, total: 1, ...records }), '1 record');
    assert.equal(
      formatResultSummary({ matched: 1, total: 12, singular: 'law entry', plural: 'law entries' }),
      '1 of 12 law entries',
    );
    assert.equal(formatResultSummary({ matched: 0, total: 12, ...records }), '0 of 12 records');
  });

  it('adds the page only when there is more than one', () => {
    assert.equal(
      formatResultSummary({ matched: 4218, total: 4218, ...records, page: 2, pageCount: 43 }),
      '4,218 records · page 2 of 43',
    );
    assert.equal(
      formatResultSummary({ matched: 12, total: 12, ...records, page: 1, pageCount: 1 }),
      '12 records',
    );
  });
});
