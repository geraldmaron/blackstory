
/**
 * Extended HTML fixture audit tests.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditHtmlFixture } from './audit.ts';

test('auditHtmlFixture flags skipped heading levels', () => {
  const result = auditHtmlFixture(`
    <main>
      <h1>Title</h1>
      <h3>Skipped h2</h3>
    </main>
  `);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === 'heading-skip-level'));
});

test('auditHtmlFixture requires nav accessible names', () => {
  const result = auditHtmlFixture(`
    <main><h1>Search</h1></main>
    <nav><a href="/search">Search</a></nav>
  `);
  assert.ok(result.issues.some((issue) => issue.code === 'nav-accessible-name'));
});
