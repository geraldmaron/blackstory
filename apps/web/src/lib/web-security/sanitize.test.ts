/**
 * XSS-oriented unit tests for HTML sanitization (BB-028).
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
