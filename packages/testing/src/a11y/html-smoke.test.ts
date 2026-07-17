/**
 * Accessibility-layer smoke tests for landmark and alt-text fixtures.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditHtmlSmoke } from './html-smoke.ts';

test('auditHtmlSmoke accepts a minimal accessible fixture', () => {
  const html = `
    <main>
      <h1>Black Book</h1>
      <img src="/hero.jpg" alt="Historic place photograph" />
    </main>
  `;
  assert.deepEqual(auditHtmlSmoke(html), []);
});

test('auditHtmlSmoke reports missing landmarks and unsafe tabindex', () => {
  const issues = auditHtmlSmoke('<div tabindex="2"><img src="/x.png"></div>');
  assert.ok(issues.some((issue) => issue.code === 'landmark-main'));
  assert.ok(issues.some((issue) => issue.code === 'heading-h1'));
  assert.ok(issues.some((issue) => issue.code === 'img-alt'));
  assert.ok(issues.some((issue) => issue.code === 'tabindex-positive'));
});
