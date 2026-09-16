/**
 * The hand-written core-journey fixtures, checked twice: by the regex audit that has always run
 * over them, and by axe-core.
 *
 * These fixtures are HAND-WRITTEN HTML, not rendered output, and that is their permanent flaw:
 * a real page can regress while its fixture here stays green, because nothing connects the two.
 * They are kept because they still assert something the rendered lanes do not — that the
 * degraded, no-JavaScript shape of each journey (a native GET form, anchors instead of buttons,
 * a list peer beside the map) is a shape somebody wrote down and agreed to.
 *
 * `design-system.test.ts` and `journey-shells.test.ts` are the lanes that audit real component
 * output. Prefer adding cases there. Adding a hand-written fixture here should need a reason.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditHtmlFixture } from './audit.ts';
import { auditRenderedMarkup, describeViolations } from './axe-harness.ts';
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

  test(`core journey "${fixture.id}" passes axe over a real accessibility tree`, async () => {
    // The regex audit above cannot compute an accessible name, resolve an aria-labelledby chain,
    // or validate an ARIA role. axe can, and these fixtures are cheap to run it over even though
    // they are hand-written.
    // `page-body`: each fixture already carries its own <main> and h1, so the harness adds only
    // the document chrome and every landmark and heading rule judges the fixture itself.
    const result = await auditRenderedMarkup(fixture.html, { mode: 'page-body' });
    assert.ok(
      result.passed,
      `${fixture.label} has ${result.violations.length} axe violation(s):\n${describeViolations(result.violations)}`,
    );
  });
}

test('every core journey fixture declares a single main landmark', () => {
  for (const fixture of CORE_JOURNEY_FIXTURES) {
    assert.match(fixture.html, /<main\b/i, `${fixture.id} missing <main>`);
  }
});
