/**
 * The empty state must always name a cause and a fix. A bare "no results" reads as an absence in
 * the archive rather than a consequence of the reader's lens, which is the misreading this copy
 * exists to prevent.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyStateCopy, type LensConstraints } from './empty-state';

const ALL_CONSTRAINTS: LensConstraints = {
  query: 'gaston',
  evidenceFloor: 'B',
  decade: '1960',
  kind: 'place',
  state: 'AL',
};

test('the documented lens copy renders exactly', () => {
  const copy = emptyStateCopy({ evidenceFloor: 'B', decade: '1960' });
  assert.equal(
    `${copy.cause} ${copy.fix}`,
    'No records match this lens. Widen the evidence floor or clear the decade.',
  );
});

test('every constraint combination names a cause and a fix', () => {
  const keys = Object.keys(ALL_CONSTRAINTS) as Array<keyof LensConstraints>;
  for (let mask = 0; mask < 1 << keys.length; mask += 1) {
    const constraints: Record<string, string> = {};
    keys.forEach((key, index) => {
      if (mask & (1 << index)) constraints[key] = ALL_CONSTRAINTS[key] as string;
    });

    const copy = emptyStateCopy(constraints as LensConstraints);
    assert.ok(copy.cause.length > 0, 'cause must never be empty');
    assert.ok(copy.fix.length > 0, 'fix must never be empty');
    assert.ok(copy.cause.endsWith('.'), 'cause is a sentence');
    assert.ok(copy.fix.endsWith('.'), 'fix is a sentence');
    assert.ok(!copy.cause.includes('—') && !copy.fix.includes('—'), 'copy law bans em dashes');
    assert.ok(
      !/^no results/i.test(copy.cause),
      'a bare "no results" is exactly what this component replaces',
    );
  }
});

test('an unfiltered empty view does not blame the reader', () => {
  const copy = emptyStateCopy({});
  assert.equal(copy.cause, 'No records loaded yet.');
  assert.equal(copy.resetLabel, undefined, 'there is no lens to reset');
  assert.ok(!copy.fix.includes('lens'));
});

test('a single constraint offers only its own loosening', () => {
  const copy = emptyStateCopy({ decade: '1960' });
  assert.equal(copy.fix, 'Clear the decade.');
  assert.equal(copy.resetLabel, 'Reset lens');
});

test('the loosening that gives back the most is offered first', () => {
  const copy = emptyStateCopy({ state: 'AL', evidenceFloor: 'A' });
  assert.match(copy.fix, /^Widen the evidence floor or widen to the whole country\.$/);
});

test('empty strings are not treated as active constraints', () => {
  const copy = emptyStateCopy({ decade: '', query: undefined });
  assert.equal(copy.cause, 'No records loaded yet.');
});
