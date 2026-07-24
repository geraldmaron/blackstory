/**
 * SSR markup smoke tests for theme-impact linked statute side rail.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { listThemeImpactLinkedStatutes } from '@repo/domain';
import { ThemeImpactLinkedStatutes } from './ThemeImpactLinkedStatutes';

test('ThemeImpactLinkedStatutes renders entity links and summaries for redlining', () => {
  const statutes = listThemeImpactLinkedStatutes('redlining');
  assert.ok(statutes.length >= 4);

  const html = renderToStaticMarkup(
    createElement(ThemeImpactLinkedStatutes, {
      statutes,
      headingId: 'test-statutes',
    }),
  );

  assert.match(html, /Acts and laws/);
  assert.match(html, /href="\/entity\/ent_law_home_owners_loan_act_1933"/);
  assert.match(html, /href="\/entity\/ent_law_fair_housing_act_1968"/);
  assert.match(html, /Loan Corporation/);
  assert.match(html, /Community Reinvestment Act/);
  assert.doesNotMatch(html, /—/);
  assert.doesNotMatch(html, /summary coming soon/i);
});

test('ThemeImpactLinkedStatutes returns null when statutes list is empty', () => {
  const html = renderToStaticMarkup(
    createElement(ThemeImpactLinkedStatutes, {
      statutes: [],
      headingId: 'empty-statutes',
    }),
  );
  assert.equal(html, '');
});
