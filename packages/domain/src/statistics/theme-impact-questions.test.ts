/** Tests for theme-impact canonical questions catalog. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  THEME_IMPACT_QUESTIONS,
  THEME_IMPACT_V1_SOURCE_ALLOWLIST,
  assertThemeImpactPhase1BindingsValid,
  getThemeImpactQuestion,
  listThemeImpactQuestionsByPriority,
  listThemeImpactQuestionsByTheme,
  resolvePhase1BindingsForQuestion,
  summarizeThemeImpactCatalog,
} from './theme-impact-questions.js';

test('theme-impact catalog has twelve unique questions and valid Phase 1 bindings', () => {
  const ids = THEME_IMPACT_QUESTIONS.map((row) => row.id);
  assert.equal(ids.length, 12);
  assert.equal(new Set(ids).size, 12);
  assertThemeImpactPhase1BindingsValid();
});

test('P0 covers redlining and drug_policy_state with timelines + indicators', () => {
  const p0 = listThemeImpactQuestionsByPriority('P0');
  assert.equal(p0.length, 6);
  assert.ok(listThemeImpactQuestionsByTheme('redlining').some((q) => q.id === 'Q1'));
  assert.ok(listThemeImpactQuestionsByTheme('drug_policy_state').some((q) => q.id === 'Q5'));
  assert.equal(getThemeImpactQuestion('Q1')?.answerShape, 'artifact_timeline');
  assert.equal(getThemeImpactQuestion('Q3')?.answerShape, 'era_indicators');
  assert.equal(getThemeImpactQuestion('Q5')?.answerShape, 'artifact_timeline');
  assert.equal(getThemeImpactQuestion('Q6')?.answerShape, 'era_indicators');
});

test('Q3 resolves Phase 1 housing and wealth metrics', () => {
  const series = resolvePhase1BindingsForQuestion('Q3');
  assert.ok(series.some((row) => row.metricId === 'acs-homeownership-rate-black-county'));
  assert.ok(series.some((row) => row.metricId === 'nhgis-homeownership-rate-black-county'));
  assert.ok(series.some((row) => row.metricId === 'scf-median-wealth-black-nation'));
  assert.ok(series.some((row) => row.metricId === 'hud-chas-cost-burden-black-county'));
});

test('summarizeThemeImpactCatalog and v1 allowlist are non-empty', () => {
  const summary = summarizeThemeImpactCatalog();
  assert.equal(summary.questionCount, 12);
  assert.equal(summary.p0Count, 6);
  assert.ok(summary.themes.includes('redlining'));
  assert.ok(summary.themes.includes('school_segregation'));
  assert.ok(summary.themes.includes('voting_rights'));
  assert.ok(THEME_IMPACT_V1_SOURCE_ALLOWLIST.includes('mapping-inequality-holc'));
  assert.ok(THEME_IMPACT_V1_SOURCE_ALLOWLIST.includes('hud-chas'));
});
