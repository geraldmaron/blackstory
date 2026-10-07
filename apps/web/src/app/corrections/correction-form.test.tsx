import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CorrectionForm } from './CorrectionForm';

test('the entity handoff has a submitted reference and a recognizable source record', () => {
  const html = renderToStaticMarkup(
    <CorrectionForm initialTarget="disc_golden_thirteen_q5579862" targetName="Golden Thirteen" />,
  );
  assert.match(html, /name="targetRecordId"[^>]*value="disc_golden_thirteen_q5579862"/);
  assert.match(html, /href="\/entity\/disc_golden_thirteen_q5579862">Golden Thirteen<\/a>/);
  assert.match(html, /<option value="entity" selected="">/);
});

test('direct entry stays blank and non-entity targets keep their supplied type', () => {
  const direct = renderToStaticMarkup(<CorrectionForm />);
  assert.match(direct, /name="targetRecordId"[^>]*value=""/);
  assert.doesNotMatch(direct, /Opened from/);
  const claim = renderToStaticMarkup(
    <CorrectionForm initialTarget="claim_example" initialTargetType="claim" />,
  );
  assert.match(claim, /<option value="claim" selected="">/);
  assert.match(claim, /name="targetRecordId"[^>]*value="claim_example"/);
});
