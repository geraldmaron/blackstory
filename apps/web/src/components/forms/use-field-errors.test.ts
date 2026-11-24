import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formOfPressedSubmit } from './use-field-errors';

/** Stands in for an element: `closest` answers only a selector that asks for a submit control. */
const inside = (control: { readonly form: unknown } | null) =>
  ({
    closest: (selector: string) => (selector.includes('[type="submit"]') ? control : null),
  }) as unknown as EventTarget;

test('a press on a submit control names its form, so that form skips the blur check', () => {
  const form = {};
  assert.equal(formOfPressedSubmit(inside({ form })), form);
});

test('a press anywhere else names no form, so blur validation runs as before', () => {
  assert.equal(formOfPressedSubmit(inside(null)), null);
  assert.equal(formOfPressedSubmit(inside({ form: null })), null);
  // `document` and `window` are event targets with no `closest`.
  assert.equal(formOfPressedSubmit({} as EventTarget), null);
  assert.equal(formOfPressedSubmit(null), null);
});
