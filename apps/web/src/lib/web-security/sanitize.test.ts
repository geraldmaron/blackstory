/**
 * XSS-oriented unit tests for HTML sanitization.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { escapeHtml, sanitizeRichText } from './sanitize';

test('escapeHtml encodes dangerous characters', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escapeHtml('"onmouseover="'), '&quot;onmouseover=&quot;');
});

test('sanitizeRichText strips script tags and content', () => {
  const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
  const output = sanitizeRichText(input);
  assert.equal(output.includes('<script'), false);
  assert.equal(output.includes('alert'), false);
  assert.match(output, /<p>Hello<\/p>/);
  assert.match(output, /<p>World<\/p>/);
});

test('sanitizeRichText removes event handler attributes', () => {
  const input = '<p onclick="alert(1)">Click</p><img src=x onerror=alert(1) />';
  const output = sanitizeRichText(input);
  assert.equal(output.includes('onclick'), false);
  assert.equal(output.includes('onerror'), false);
  assert.equal(output.includes('<img'), false);
});

test('sanitizeRichText blocks javascript: hrefs', () => {
  const input = '<a href="javascript:alert(1)">bad</a><a href="/safe">ok</a>';
  const output = sanitizeRichText(input);
  assert.equal(output.includes('javascript:'), false);
  assert.match(output, /href="\/safe"/);
});

test('markdown-style rich text cannot inject executable markup', () => {
  const markdownHtml = [
    '# Title',
    '<p>Normal **bold** text</p>',
    '<iframe src="https://evil.example"></iframe>',
    '<a href="data:text/html,<script>alert(1)</script>">link</a>',
    '<style>body{background:url(javascript:alert(1))}</style>',
    '<svg onload=alert(1)></svg>',
  ].join('\n');

  const output = sanitizeRichText(markdownHtml);
  assert.equal(output.includes('<iframe'), false);
  assert.equal(output.includes('<style'), false);
  assert.equal(output.includes('<svg'), false);
  assert.equal(output.includes('javascript:'), false);
  assert.equal(output.includes('onload'), false);
  assert.equal(output.includes('data:text/html'), false);
});

test('sanitizeRichText preserves allowed formatting tags', () => {
  const input = '<p><strong>Bold</strong> and <em>italic</em></p><ul><li>one</li></ul>';
  const output = sanitizeRichText(input);
  assert.match(output, /<strong>Bold<\/strong>/);
  assert.match(output, /<em>italic<\/em>/);
  assert.match(output, /<ul><li>one<\/li><\/ul>/);
});

test('sanitizeRichText allows safe external https links', () => {
  const input = '<a href="https://example.org/path" title="Example">link</a>';
  const output = sanitizeRichText(input);
  assert.match(output, /href="https:\/\/example\.org\/path"/);
  assert.match(output, /title="Example"/);
});

test('the attribute allowlist drops every dangerous attribute shape', () => {
  // These used to be caught by blocklist regexes running before the allowlist rebuild. The
  // rebuild is what actually removes them: RICH_TEXT_ALLOWED_ATTRS permits href/title/rel on
  // `<a>` and nothing anywhere else, so anything not on the list is dropped by omission.
  const cases = [
    `<p onclick="alert(1)">x</p>`,
    `<p ONCLICK="alert(1)">x</p>`,
    `<p onmouseover='alert(1)'>x</p>`,
    `<a href="javascript:alert(1)">x</a>`,
    `<a href="  JaVaScRiPt:alert(1)">x</a>`,
    `<a href="data:text/html,<b>">x</a>`,
    `<a href="vbscript:msgbox">x</a>`,
    `<button formaction="javascript:alert(1)">x</button>`,
    `<p xlink:href="javascript:alert(1)">x</p>`,
    `<img src="javascript:alert(1)">`,
  ];
  for (const input of cases) {
    const out = sanitizeRichText(input);
    assert.equal(/on\w+\s*=/i.test(out), false, `event handler survived: ${input} -> ${out}`);
    assert.equal(/javascript:/i.test(out), false, `javascript: survived: ${input} -> ${out}`);
    assert.equal(/vbscript:/i.test(out), false, `vbscript: survived: ${input} -> ${out}`);
    assert.equal(/formaction/i.test(out), false, `formaction survived: ${input} -> ${out}`);
    assert.equal(/xlink:href/i.test(out), false, `xlink:href survived: ${input} -> ${out}`);
    assert.equal(/\sdata:/i.test(out), false, `data: survived: ${input} -> ${out}`);
  }
});

test('a safe link keeps exactly its allowlisted attributes', () => {
  const out = sanitizeRichText(
    '<a href="https://example.org" title="T" rel="noreferrer" id="x">L</a>',
  );
  assert.match(out, /href="https:\/\/example\.org"/);
  assert.match(out, /title="T"/);
  assert.match(out, /rel="noreferrer"/);
  assert.equal(/id=/.test(out), false, 'a non-allowlisted attribute survived');
});

test('sanitizeRichText strips markup that a single pass would reconstitute', () => {
  // One pass can create the thing it just removed: deleting the inner `<script>` from
  // `<scr<script>ipt>` leaves `<script>` behind. Sanitizing to a fixed point closes that.
  const nested = sanitizeRichText('<scr<script>ipt>alert(1)</scr</script>ipt>');
  assert.equal(/<script/i.test(nested), false, 'a reconstituted script tag survived');

  const handler = sanitizeRichText(`<p on<onx="">click="alert(1)">hi</p>`);
  assert.equal(/onclick\s*=/i.test(handler), false, 'a reconstituted event handler survived');
});
