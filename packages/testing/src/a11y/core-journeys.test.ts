
/**
 * automated accessibility checks for core journey HTML fixtures.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditHtmlFixture } from './audit.ts';
import { CORE_JOURNEY_FIXTURES } from './journey-fixtures.ts';

for (const fixture of CORE_JOURNEY_FIXTURES) {
  test(`core journey "${fixture.id}" passes landmark and heading audits`, () => {
    const result = auditHtmlFixture(fixture.html);
    assert.equal(
      result.passed,
      true,
      `${fixture.label} failed: ${result.issues.map((issue) => issue.code).join(', ')}`,
    );
  });
}

test('every core journey fixture declares a single main landmark', () => {
  for (const fixture of CORE_JOURNEY_FIXTURES) {
    assert.match(fixture.html, /<main\b/i, `${fixture.id} missing <main>`);
  }
});
