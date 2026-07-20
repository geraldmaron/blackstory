/**
 * Regression test for a real bug found running this against nps.gov: the
 * shared `parseContentInSandbox`'s `active_content` check (any <script> tag)
 * rejected virtually every real institutional website, since almost all of
 * them carry a script tag with no bearing on maliciousness. This module's
 * `parseTextOnly` intentionally drops that check (text-only consumer, never
 * renders/executes the HTML) while keeping the genuine malware-signature
 * checks — these tests guard both halves of that decision.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkMalwareSignatures, parseTextOnly } from './safe-fetch.ts';

test('parseTextOnly treats ordinary <script>-bearing HTML as safe', async () => {
  const html = `<html><head><script>gtag('config', 'X');</script></head>
    <body><nav onclick="doThing()">Nav</nav><article><p>Real content about a historic site.</p></article></body></html>`;
  const result = await parseTextOnly(new TextEncoder().encode(html), 'text/html');
  assert.equal(result.safe, true);
  assert.deepEqual(result.indicators, []);
  assert.match(result.extractedText, /Real content about a historic site/u);
  assert.doesNotMatch(result.extractedText, /gtag/u);
});

test('checkMalwareSignatures still flags the EICAR test signature', () => {
  const content = new TextEncoder().encode('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
  assert.deepEqual(checkMalwareSignatures(content), ['eicar_test_signature']);
});

test('checkMalwareSignatures still flags executable magic bytes (MZ)', () => {
  const content = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
  assert.deepEqual(checkMalwareSignatures(content), ['executable_magic']);
});

test('checkMalwareSignatures does not flag ordinary text', () => {
  const content = new TextEncoder().encode('<html><body><p>Nothing suspicious here.</p></body></html>');
  assert.deepEqual(checkMalwareSignatures(content), []);
});
