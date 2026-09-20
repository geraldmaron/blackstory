import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fidelityProblems, fidelityTokens, sha256 } from './fix-lives-impact-statement-voice.ts';

const OLD =
  'Registration rose from roughly 6 percent to around 60 percent within four years — after Gomillion v. Lightfoot (1960) — and some 2,000 officeholders followed, holding it a "badge and incident of slavery."';

function rewrite(impactStatement: string, tokens: readonly string[] = []) {
  return {
    id: 'x',
    expectedOldSha256: sha256(OLD),
    impactStatement,
    fidelityExceptions: tokens.map((token) => ({ token, reason: 'test' })),
  };
}

test('a rewording that only changes punctuation carries every fact across', () => {
  const next = OLD.replace(' — after', ', after').replace(' — and some', ', and some');
  assert.deepEqual(fidelityProblems(OLD, rewrite(next)), []);
});

test('a dropped number, name or quotation is reported, and so is an invented one', () => {
  const dropped = OLD.replace('roughly 6 percent', 'a small share').replace(
    'Gomillion v. Lightfoot',
    'a 1960 ruling',
  );
  const problems = fidelityProblems(OLD, rewrite(dropped)).join('\n');
  assert.match(problems, /drops number "6"/);
  assert.match(problems, /drops name "Gomillion"/);

  const invented = `${OLD} By 1972 it was 70 percent in Alabama.`;
  const added = fidelityProblems(OLD, rewrite(invented)).join('\n');
  assert.match(added, /introduces number "1972"/);
  assert.match(added, /introduces name "Alabama"/);

  const noQuote = OLD.replace('a "badge and incident of slavery."', 'a relic of slavery.');
  assert.match(
    fidelityProblems(OLD, rewrite(noQuote)).join('\n'),
    /drops quote "badge and incident of slavery"/,
  );
});

test('a listed exception is allowed through, and nothing else is', () => {
  const dropped = OLD.replace('some 2,000 officeholders', 'many officeholders');
  assert.deepEqual(fidelityProblems(OLD, rewrite(dropped, ['2,000'])), []);
});

test('a trailing comma is punctuation, not part of a year', () => {
  assert.deepEqual(fidelityTokens('built before 1968, with 2,000 homes').numbers, [
    '1968',
    '2,000',
  ]);
});
