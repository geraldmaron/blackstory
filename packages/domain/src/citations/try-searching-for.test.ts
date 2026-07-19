/**
 * the deterministic "Try searching for" suggestion. Explicitly
 * verifies determinism and the "no LLM required" property.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildTrySearchingForSubject,
  buildTrySearchingForSuggestion,
} from './try-searching-for.js';

test('builds the owner-brief example shape from title, author, and named entities', () => {
  const suggestion = buildTrySearchingForSuggestion({
    title: 'Rosewood massacre grand jury report',
    sourceName: 'Florida State Archives',
    authorName: undefined,
    namedEntities: ['1923', 'Florida'],
  });
  assert.equal(suggestion, 'Try searching for: "Rosewood massacre grand jury report 1923 Florida"');
});

test('falls back to sourceName when no title is stored', () => {
  const subject = buildTrySearchingForSubject({
    title: undefined,
    sourceName: 'Local Gazette',
    authorName: 'Jane Reporter',
    namedEntities: undefined,
  });
  assert.equal(subject, 'Local Gazette Jane Reporter');
});

test('caps named entities to the first three', () => {
  const subject = buildTrySearchingForSubject({
    title: 'Court filing',
    sourceName: 'County Clerk',
    authorName: undefined,
    namedEntities: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'],
  });
  assert.equal(subject, 'Court filing Alpha Beta Gamma');
});

test('never throws and returns a usable fallback when every field is empty', () => {
  const suggestion = buildTrySearchingForSuggestion({
    title: undefined,
    sourceName: '',
    authorName: undefined,
    namedEntities: undefined,
  });
  assert.equal(typeof suggestion, 'string');
  assert.match(suggestion, /^Try searching for:/);
});

test('is deterministic: repeated calls with the same input produce the identical string', () => {
  const citation = {
    title: 'Grand jury report',
    sourceName: 'State Attorney',
    authorName: 'J. Doe',
    namedEntities: ['Levy County', '1923'],
  };
  const first = buildTrySearchingForSuggestion(citation);
  const second = buildTrySearchingForSuggestion(citation);
  const third = buildTrySearchingForSuggestion({ ...citation });
  assert.equal(first, second);
  assert.equal(second, third);
});

test('no-LLM-call property: the builder is a plain synchronous function, not async, and returns a string synchronously with no awaited value', () => {
  // An LLM or network call would require this to be async (or return a Promise/thenable).
  // Asserting the function is synchronous and its return value is a plain string (not a
  // Promise) is a structural proof that no round trip can occur inside it.
  assert.equal(buildTrySearchingForSuggestion.constructor.name, 'Function');
  const result = buildTrySearchingForSuggestion({
    title: 'Test',
    sourceName: 'Test Source',
    authorName: undefined,
    namedEntities: undefined,
  });
  assert.equal(typeof result, 'string');
  assert.equal(typeof (result as unknown as { then?: unknown }).then, 'undefined');
});
