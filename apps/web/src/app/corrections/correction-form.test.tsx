import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CorrectionForm } from './CorrectionForm';
import { validateCorrectionForm } from './correction-form';

function checked(html: string, value: string): boolean {
  return new RegExp(
    `<input[^>]*value="${value}"[^>]*checked=""|<input[^>]*checked=""[^>]*value="${value}"`,
  ).test(html);
}

test('the entity handoff has a submitted reference and a recognizable source record', () => {
  const html = renderToStaticMarkup(
    <CorrectionForm initialTarget="disc_golden_thirteen_q5579862" targetName="Golden Thirteen" />,
  );
  assert.match(html, /name="targetRecordId"[^>]*value="disc_golden_thirteen_q5579862"/);
  assert.match(html, /href="\/entity\/disc_golden_thirteen_q5579862">Golden Thirteen<\/a>/);
  assert.ok(checked(html, 'entity'), 'the entity target is chosen');
});

test('direct entry stays blank and non-entity targets keep their supplied type', () => {
  const direct = renderToStaticMarkup(<CorrectionForm />);
  assert.match(direct, /name="targetRecordId"[^>]*value=""/);
  assert.doesNotMatch(direct, /Opened from/);
  const claim = renderToStaticMarkup(
    <CorrectionForm initialTarget="claim_example" initialTargetType="claim" />,
  );
  assert.ok(checked(claim, 'claim'));
  assert.ok(!checked(claim, 'entity'));
  assert.match(claim, /name="targetRecordId"[^>]*value="claim_example"/);
});

test('every required field is marked the same way, and the form says what the mark means', () => {
  const html = renderToStaticMarkup(<CorrectionForm />);
  assert.match(html, /are required\./);
  assert.equal(html.match(/ds-form-required/g)?.length, 5);
  assert.equal(html.match(/type="submit"/g)?.length, 1);
});

test('an empty correction is told how to fix each required answer', () => {
  const errors = validateCorrectionForm(new FormData());
  assert.deepEqual(Object.keys(errors).sort(), [
    'category',
    'privacyConsent',
    'sourceUrl',
    'statement',
    'targetRecordId',
  ]);
  const data = new FormData();
  data.set('targetRecordId', 'Fifteenth Street Presbyterian Church');
  data.set('category', 'factual_error');
  data.set('statement', 'The 1891 building was purpose-built, not converted.');
  data.set('sourceUrl', 'www.loc.gov/item/1');
  data.set('privacyConsent', 'on');
  assert.deepEqual(Object.keys(validateCorrectionForm(data)), ['sourceUrl']);
  data.set('sourceUrl', 'https://www.loc.gov/item/1');
  assert.deepEqual(validateCorrectionForm(data), {});
});
