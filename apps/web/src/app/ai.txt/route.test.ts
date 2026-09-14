/**
 * /ai.txt must read as a courtesy crawl signal plus an accurate license pointer, not a rights
 * claim the site's CC BY 4.0 license does not back. Guards against regressing to language that
 * implies AI training is disallowed, which contradicts a license that explicitly permits it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GET } from './route';

async function bodyText(): Promise<string> {
  const response = GET();
  return response.text();
}

test('ai.txt names CC BY 4.0 and links the deed', async () => {
  const text = await bodyText();
  assert.match(text, /CC BY 4\.0/);
  assert.match(text, /https:\/\/creativecommons\.org\/licenses\/by\/4\.0\//);
});

test("ai.txt scopes the license to BlackStory's own writing, not third-party media", async () => {
  const text = await bodyText();
  assert.match(text, /BlackStory's own (written content|writing)/);
  assert.match(text, /does not cover the/i);
  assert.match(text, /Wikimedia Commons/);
  assert.match(text, /Open Library/);
  assert.match(text, /Internet Archive/);
  assert.match(text, /USGS/);
  assert.match(text, /OpenStreetMap/);
});

test('ai.txt states the attribution CC BY requires', async () => {
  const text = await bodyText();
  assert.match(text, /Attribution required/i);
});

test('ai.txt keeps the bulk-access ask phrased as a request, and keeps the contact pointer', async () => {
  const text = await bodyText();
  // Asserted as intent rather than as one phrase: the ask must read as a request a crawler may
  // decline, not as a prohibition, because the license above already permits the use.
  assert.match(text, /ask for bulk access/i);
  assert.match(text, /\/\.well-known\/security\.txt/);
});

test('ai.txt explains that the Disallow lines are about fetching, not about permission', async () => {
  const text = await bodyText();
  // The file both grants CC BY (which permits training) and asks named training crawlers not to
  // crawl. That reads as a contradiction unless the file says which one it is: the objection is
  // the bandwidth cost of the crawl, never the training. If this assertion is ever deleted, the
  // file goes back to looking like a rights claim it does not make.
  assert.match(text, /not whether you may use it/i);
  assert.match(text, /is the objection, not the training/i);
});

test('ai.txt contains no claim that AI training is disallowed', async () => {
  const text = await bodyText();
  assert.doesNotMatch(text, /not a corpus offered/i);
  assert.doesNotMatch(text, /unrestricted AI-training ingestion/i);
  assert.doesNotMatch(text, /AI training is (not )?(disallowed|prohibited|forbidden)/i);
});

test('ai.txt is served as plain text', async () => {
  const response = GET();
  assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8');
});
