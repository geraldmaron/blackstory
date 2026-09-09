/**
 * The planner's contract: a deficit becomes a research task, the task validates against the
 * kernel's real EvidenceNeed schema, and nothing a search cannot close gets a search.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateContract } from '@repo/research-kernel';
import type { ResearchDeficit } from '@repo/domain';

import {
  type PlanContext,
  describePlan,
  planEnrichment,
  targetIsAbove,
} from './enrichment-plan.ts';

function deficit(code: ResearchDeficit['code'], correctionRisk = false): ResearchDeficit {
  return {
    code,
    correctionRisk,
    explanation: `explanation for ${code}`,
    remediation: `remediation for ${code}`,
  };
}

const CONTEXT: PlanContext = { subjectName: 'Lewis H. Latimer' };

function plan(deficits: readonly ResearchDeficit[], context: PlanContext = CONTEXT) {
  return planEnrichment({
    entityId: 'ent_latimer',
    currentMaturity: 'seeded',
    targetMaturity: 'corroborated',
    deficits,
    context,
  });
}

test('every planned evidence need validates against the kernel contract', () => {
  // The planner declares the shape locally rather than importing it; this is what stops that
  // from drifting into a shape the kernel would reject.
  const result = plan([
    deficit('wikipedia_only_summary_claim', true),
    deficit('missing_identity_receipt'),
    deficit('single_lineage_high_impact_claim'),
  ]);
  assert.ok(result.evidenceNeeds.length >= 3);
  for (const need of result.evidenceNeeds) {
    const validation = validateContract('EvidenceNeed', need);
    assert.ok(validation.ok, `EvidenceNeed rejected: ${JSON.stringify(validation)}`);
  }
  for (const question of result.questions) {
    const validation = validateContract('ResearchQuestion', question);
    assert.ok(validation.ok, `ResearchQuestion rejected: ${JSON.stringify(validation)}`);
  }
});

test('a correction risk is planned before a merely thin record', () => {
  // Leaving the wrong sentence up is worse than leaving a thin one.
  const result = plan([
    deficit('no_primary_or_archival_receipt'),
    deficit('wikipedia_only_summary_claim', true),
  ]);
  assert.equal(result.questions[0]?.question.includes('underlying work'), true);
  assert.equal(result.questions[0]?.priority, 100);
});

test('one deficit code produces one research task however many claims share it', () => {
  // Three claims missing a second lineage is one search, not three.
  const result = plan([
    deficit('single_lineage_high_impact_claim'),
    deficit('single_lineage_high_impact_claim'),
    deficit('single_lineage_high_impact_claim'),
  ]);
  assert.equal(result.evidenceNeeds.length, 1);
});

test('the identity need never asks a technical record about race', () => {
  // The single most important query set in the module.
  const result = plan([deficit('missing_identity_receipt')]);
  const need = result.evidenceNeeds.find((n) => n.id.includes('missing-identity-receipt'));
  assert.ok(need !== undefined);
  assert.equal(need?.mandatory, true);
  assert.match(need?.description ?? '', /Patent Office did not record inventor race/u);

  const queries = result.queries.filter((query) => query.needId === need?.id).map((x) => x.query);
  assert.ok(queries.some((query) => query.includes('Henry Baker')));
  assert.ok(queries.some((query) => query.includes('Black press')));
  // No query in this need reaches for a patent to answer an identity question.
  assert.equal(
    queries.some((query) => /patent(?!s?\.gov)/iu.test(query)),
    false,
    'an identity need must not search patents',
  );
});

test('invention context adds priority queries that a non-invention record does not get', () => {
  const generic = plan([deficit('superlative_without_institutional_support')]);
  const invention = plan([deficit('superlative_without_institutional_support')], {
    subjectName: 'Lewis H. Latimer',
    inventionContext: true,
  });
  assert.ok(invention.queries.length > generic.queries.length);
  assert.ok(invention.queries.some((query) => query.query.includes('prior art')));
  assert.ok(invention.queries.some((query) => query.query.includes('interference')));
});

test('a known patent number is searched by number rather than re-derived from the name', () => {
  const result = plan([deficit('invention_scope_broader_than_patent')], {
    subjectName: 'Lewis H. Latimer',
    inventionContext: true,
    knownPatentNumbers: ['252386'],
  });
  assert.ok(result.queries.some((query) => query.query.includes('"252386"')));
});

test('a place hint narrows the archival queries', () => {
  const withPlace = plan([deficit('no_primary_or_archival_receipt')], {
    subjectName: 'Jan E. Matzeliger',
    placeHint: 'Lynn, Massachusetts',
  });
  assert.ok(withPlace.queries.some((query) => query.query.includes('Lynn, Massachusetts')));
});

test('a deficit no search can close is named, not silently dropped', () => {
  // No amount of searching creates a column to store a document date in. Planning a query for
  // it would put an unclosable need in every plan forever.
  const result = plan([
    deficit('missing_creation_or_publication_date'),
    deficit('generic_confidence_dimension'),
    deficit('claim_without_evidence_selector'),
  ]);
  assert.deepEqual([...result.unaddressedDeficits].sort(), [
    'claim_without_evidence_selector',
    'generic_confidence_dimension',
    'missing_creation_or_publication_date',
  ]);
  assert.equal(result.evidenceNeeds.length, 0);
});

test('a plan that found nothing to do still reports a finding', () => {
  // An enrichment run that reports nothing teaches the next run nothing.
  const empty = plan([]);
  assert.match(describePlan(empty), /no deficits and no research planned/u);

  const unsearchable = plan([deficit('missing_creation_or_publication_date')]);
  assert.match(describePlan(unsearchable), /no searchable remedy/u);
});

test('mandatory needs are the ones that gate deep_research and reference', () => {
  const result = plan([deficit('missing_identity_receipt'), deficit('source_type_monoculture')]);
  const identity = result.evidenceNeeds.find((n) => n.id.includes('identity'));
  const monoculture = result.evidenceNeeds.find((n) => n.id.includes('monoculture'));
  assert.equal(identity?.mandatory, true);
  assert.equal(monoculture?.mandatory, false);
});

test('needs that require a contradiction search say so', () => {
  const result = plan([
    deficit('superlative_without_institutional_support'),
    deficit('high_impact_attribution_without_prior_art_search'),
    deficit('no_primary_or_archival_receipt'),
  ]);
  const byId = Object.fromEntries(result.evidenceNeeds.map((n) => [n.id, n]));
  assert.equal(
    Object.values(byId).filter((n) => n.contradictionSearch).length,
    2,
    'firstness and attribution need a contradiction search; a thin record does not',
  );
});

test('every query belongs to a need that exists', () => {
  const result = plan([
    deficit('bridge_only_entity'),
    deficit('missing_place_receipt'),
    deficit('unresolved_contradiction'),
  ]);
  const needIds = new Set(result.evidenceNeeds.map((n) => n.id));
  for (const query of result.queries) {
    assert.ok(needIds.has(query.needId), `orphan query for ${query.needId}`);
  }
  assert.ok(result.queries.every((query) => query.needId !== ''));
});

test('targetIsAbove refuses to plan work for a target already reached', () => {
  assert.equal(targetIsAbove('seeded', 'corroborated'), true);
  assert.equal(targetIsAbove('deep_research', 'grounded'), false);
  assert.equal(targetIsAbove('reference', 'reference'), false);
});
