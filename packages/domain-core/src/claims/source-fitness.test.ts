import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ASSERTION_CLASSES,
  SOURCE_CLASSES,
  assessSourceFitness,
  isHighImpactAssertion,
  isUnfitFor,
  sourceAuthorityForFitness,
} from './source-fitness.ts';

test('a patent is authoritative for what it records and unfit for who the filer was', () => {
  // The single distinction this module exists to make.
  assert.equal(assessSourceFitness('patent_specification', 'record_fact').fitness, 'authoritative');
  assert.equal(
    assessSourceFitness('patent_specification', 'technical_scope').fitness,
    'authoritative',
  );
  assert.equal(assessSourceFitness('patent_specification', 'community_identity').fitness, 'unfit');
});

test('a patent cannot establish firstness, commercial success, or societal impact', () => {
  // Case E and Case K. A grant is not a finding of priority over a whole field.
  for (const assertion of ['superlative', 'commercial_impact', 'societal_impact'] as const) {
    assert.equal(
      assessSourceFitness('patent_specification', assertion).fitness,
      'unfit',
      `patent should be unfit for ${assertion}`,
    );
  }
});

test('an unfit source contributes zero authority, so unfit sources cannot accumulate', () => {
  // Ten patents still say nothing about race. A small non-zero value would let them add up.
  assert.equal(sourceAuthorityForFitness('unfit'), 0);
  assert.ok(sourceAuthorityForFitness('leadOnly') > 0);
});

test('race is never derivable from a technical record, whichever technical record it is', () => {
  const technicalRecords = [
    'patent_specification',
    'patent_application',
    'patent_assignment_record',
    'patent_file_wrapper',
    'patent_interference_record',
  ] as const;
  for (const source of technicalRecords) {
    assert.ok(
      isUnfitFor(source, 'community_identity'),
      `${source} must be unfit for community_identity`,
    );
  }
});

test('a historical compilation is strong for community identity and weak for technical scope', () => {
  // Baker's list is why a person is known to be a Black inventor, and says nothing about
  // how the device worked.
  assert.equal(
    assessSourceFitness('historical_compilation', 'community_identity').fitness,
    'strong',
  );
  assert.equal(
    assessSourceFitness('historical_compilation', 'technical_scope').fitness,
    'leadOnly',
  );
});

test('a modern secondary source may carry an attribution but never settles one', () => {
  // The class that carries "invented the light bulb".
  assert.equal(
    assessSourceFitness('modern_reputable_secondary', 'invention_attribution').fitness,
    'leadOnly',
  );
  assert.equal(
    assessSourceFitness('modern_reputable_secondary', 'superlative').fitness,
    'leadOnly',
  );
});

test('a bridge is unfit for a superlative and for an attribution', () => {
  // The standing rule, stated where the scorer can see it.
  assert.ok(isUnfitFor('wikipedia_bridge', 'superlative'));
  assert.ok(isUnfitFor('wikipedia_bridge', 'invention_attribution'));
  assert.ok(isUnfitFor('wikidata_bridge', 'community_identity'));
});

test('scholarship and interference records are the sources that CAN speak to firstness', () => {
  // A superlative gate that nothing could ever satisfy would be a bug, not rigour.
  assert.equal(assessSourceFitness('peer_reviewed_scholarship', 'superlative').fitness, 'strong');
  assert.equal(assessSourceFitness('patent_interference_record', 'superlative').fitness, 'strong');
  assert.equal(
    assessSourceFitness('institutional_biography', 'superlative').fitness,
    'conditional',
  );
});

test('a patent is only a lead for where invention happened', () => {
  // The face of a patent gives an address at filing, not a workshop.
  assert.equal(assessSourceFitness('patent_specification', 'place').fitness, 'leadOnly');
  assert.equal(assessSourceFitness('census_or_vital_record', 'place').fitness, 'strong');
});

test('period newspapers are strong on chronology and only a lead on mechanism', () => {
  assert.equal(assessSourceFitness('contemporaneous_newspaper', 'chronology').fitness, 'strong');
  assert.equal(
    assessSourceFitness('contemporaneous_newspaper', 'technical_scope').fitness,
    'leadOnly',
  );
});

test('a patent carries its known limitations even where it is authoritative', () => {
  const assessment = assessSourceFitness('patent_specification', 'record_fact');
  assert.equal(assessment.fitness, 'authoritative');
  assert.ok(assessment.limitations.length > 0);
  assert.ok(
    assessment.limitations.some((l) => l.includes('address at filing')),
    'the filing-address limitation must travel with the patent',
  );
});

test('every source class answers every assertion class with a known fitness', () => {
  // A missing row would silently fall through to a default nobody chose.
  for (const source of SOURCE_CLASSES) {
    for (const assertion of ASSERTION_CLASSES) {
      const assessment = assessSourceFitness(source, assertion);
      assert.ok(
        ['authoritative', 'strong', 'conditional', 'leadOnly', 'unfit'].includes(
          assessment.fitness,
        ),
        `${source} x ${assertion} produced ${assessment.fitness}`,
      );
    }
  }
});

test('an out-of-vocabulary source class throws instead of quietly scoring low', () => {
  // The old lookup turned a typo into a downgrade. A typo is a bug, not a weak source.
  assert.throws(
    () => assessSourceFitness('patent_speciffication' as never, 'record_fact'),
    /Unknown source class/u,
  );
  assert.throws(
    () => assessSourceFitness('patent_specification', 'recordfact' as never),
    /Unknown assertion class/u,
  );
});

test('attribution, firstness and identity are high impact; an ordinary date is not', () => {
  assert.ok(isHighImpactAssertion('invention_attribution'));
  assert.ok(isHighImpactAssertion('superlative'));
  assert.ok(isHighImpactAssertion('community_identity'));
  assert.equal(isHighImpactAssertion('biographical_fact'), false);
  assert.equal(isHighImpactAssertion('record_fact'), false);
});
