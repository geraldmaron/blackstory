import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leadIssueField, validateLeadForm } from './lead-form';

const CONTACT = 'archive@example.org';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

test('an empty lead asks for the two required answers, each saying how to fix it', () => {
  const errors = validateLeadForm(form({}), CONTACT);
  assert.deepEqual(Object.keys(errors).sort(), ['url', 'whyItMatters']);
  assert.match(errors.url!, /Add the link/);
  assert.match(errors.url!, /If there is no link, write to archive@example\.org instead\./);
  assert.match(errors.whyItMatters!, /at least 10 characters/);
});

test('a complete lead passes, and optional fields are checked only when filled', () => {
  const ok = form({
    url: 'https://example.org/post',
    whyItMatters: 'It names the first teacher at the school.',
  });
  assert.deepEqual(validateLeadForm(ok, CONTACT), {});
  ok.set('contact', 'not an email');
  assert.match(validateLeadForm(ok, CONTACT).contact!, /needs an @/);
  ok.set('url', 'example.org/post');
  assert.match(validateLeadForm(ok, CONTACT).url!, /https:\/\//);
});

test('each long answer is told its own limit by name', () => {
  const errors = validateLeadForm(
    form({
      url: 'https://example.org/post',
      description: 'd'.repeat(4001),
      whyItMatters: 'It names the first teacher at the school.',
      location: 'l'.repeat(201),
      era: 'e'.repeat(201),
    }),
    CONTACT,
  );
  assert.equal(errors.description, 'Keep “What you know” to 4,000 characters or fewer.');
  assert.equal(errors.location, 'Keep “Where” to 200 characters or fewer.');
  assert.equal(errors.era, 'Keep “When” to 200 characters or fewer.');
});

test('answers each within their limit can be too long together, and the form says by how much', () => {
  const lead = form({
    url: 'https://example.org/post',
    description: 'd'.repeat(3000),
    whyItMatters: 'w'.repeat(3000),
  });
  const errors = validateLeadForm(lead, CONTACT);
  assert.deepEqual(Object.keys(errors), ['whyItMatters']);
  assert.match(errors.whyItMatters!, /can hold 6,000 characters, and this is \d+ over/);
  lead.set('whyItMatters', 'w'.repeat(2900));
  assert.deepEqual(validateLeadForm(lead, CONTACT), {});
  // The place, the period and the attestation line count toward the same total.
  lead.set('location', 'l'.repeat(200));
  assert.deepEqual(Object.keys(validateLeadForm(lead, CONTACT)), ['whyItMatters']);
});

test('the quarantine names the link field sourceUrls; the form shows it on the link', () => {
  assert.equal(leadIssueField('sourceUrls'), 'url');
  assert.equal(leadIssueField('whyItMatters'), 'whyItMatters');
});
