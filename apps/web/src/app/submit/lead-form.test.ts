import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leadIssueField, validateLeadForm } from './lead-form';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

test('an empty lead asks for the two required answers, each saying how to fix it', () => {
  const errors = validateLeadForm(form({}));
  assert.deepEqual(Object.keys(errors).sort(), ['url', 'whyItMatters']);
  assert.match(errors.url!, /Add the link/);
  assert.match(errors.whyItMatters!, /at least 10 characters/);
});

test('a complete lead passes, and optional fields are checked only when filled', () => {
  const ok = form({
    url: 'https://example.org/post',
    whyItMatters: 'It names the first teacher at the school.',
  });
  assert.deepEqual(validateLeadForm(ok), {});
  ok.set('contact', 'not an email');
  assert.match(validateLeadForm(ok).contact!, /needs an @/);
  ok.set('url', 'example.org/post');
  assert.match(validateLeadForm(ok).url!, /https:\/\//);
});

test('the quarantine names the link field sourceUrls; the form shows it on the link', () => {
  assert.equal(leadIssueField('sourceUrls'), 'url');
  assert.equal(leadIssueField('whyItMatters'), 'whyItMatters');
});
