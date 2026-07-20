/**
 * Unit tests for curated Did-you-know facts — every fact must carry at least one
 * https source URL and a non-empty statement.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import {
  HISTORY_DID_YOU_KNOW_FACTS,
  selectDidYouKnowFacts,
} from '../../lib/history/did-you-know';
import { HistoryDidYouKnow } from './HistoryDidYouKnow';

test('HISTORY_DID_YOU_KNOW_FACTS entries are sourced and non-empty', () => {
  assert.ok(HISTORY_DID_YOU_KNOW_FACTS.length >= 5);
  for (const fact of HISTORY_DID_YOU_KNOW_FACTS) {
    assert.ok(fact.id.length > 0);
    assert.ok(fact.statement.length > 40, fact.id);
    assert.ok(fact.sources.length >= 1, fact.id);
    for (const source of fact.sources) {
      assert.ok(source.label.length > 0, fact.id);
      assert.match(source.url, /^https:\/\//, `${fact.id} ${source.label}`);
    }
  }
});

test('selectDidYouKnowFacts is deterministic for a seed', () => {
  const a = selectDidYouKnowFacts(2, 7);
  const b = selectDidYouKnowFacts(2, 7);
  assert.deepEqual(a, b);
  assert.equal(a.length, 2);
});

test('HistoryDidYouKnow renders statements and source footnotes', () => {
  const html = renderToStaticMarkup(
    createElement(HistoryDidYouKnow, {
      facts: HISTORY_DID_YOU_KNOW_FACTS.slice(0, 1),
    }),
  );
  assert.match(html, /From the archive/);
  assert.match(html, /Fort Mose/);
  assert.match(html, /floridastateparks\.org/);
});
