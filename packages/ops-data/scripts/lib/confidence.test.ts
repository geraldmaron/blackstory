/**
 * Regression tests for corsair confidence wiring: host classification and the
 * multi-source publish threshold used by auto-promote / rejudge gates.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifySourceForConfidence,
  computeClaimConfidence,
  confidenceLevelForSource,
} from './confidence.ts';
import { setSourceRegisterForTesting, type SourceRegisterFile } from './source-register.ts';

const DC_PRESERVATION = 'https://historicsites.dcpreservation.org/site/123-example-historic-place';
const NPS_GOV = 'https://www.nps.gov/places/example-historic-site.htm';
const WIKIPEDIA = 'https://en.wikipedia.org/wiki/Example_Historic_Site';

test('classifySourceForConfidence maps curated heritage hosts to reputable_secondary', () => {
  assert.equal(classifySourceForConfidence(DC_PRESERVATION), 'reputable_secondary');
  assert.equal(
    classifySourceForConfidence('https://www.hmdb.org/m.asp?m=12345'),
    'reputable_secondary',
  );
  assert.equal(
    classifySourceForConfidence('https://digdc.dclibrary.org/islandora/object/pdc%3A123'),
    'reputable_secondary',
  );
  assert.equal(
    classifySourceForConfidence('https://www.blackpast.org/african-american-history/example/'),
    'reputable_secondary',
  );
});

const TEST_REGISTER: SourceRegisterFile = {
  version: 1,
  entries: [
    {
      host: 'test-archive.example',
      sourceClass: 'reputable_secondary',
      orgType: 'archive',
      label: 'Test State Archive',
      basis: {
        wikidata: 'Q1',
        officialWebsite: 'https://test-archive.example/',
        authorityIds: { lcnaf: 'n00000001' },
        instanceOf: ['Q166118'],
      },
      reviewedBy: 'test',
      reviewedAt: '2026-09-10T00:00:00.000Z',
      verifiedAt: '2026-09-10T00:00:00.000Z',
    },
    {
      // Deliberately a host the curated suffix list already calls reputable_secondary, so this
      // proves which one the classifier asks first.
      host: 'hmdb.org',
      sourceClass: 'news_reportage',
      orgType: 'news_publisher',
      label: 'Not really a newspaper — ordering fixture',
      basis: {
        wikidata: 'Q2',
        officialWebsite: 'https://hmdb.org/',
        authorityIds: { viaf: '2' },
        instanceOf: ['Q11032'],
      },
      reviewedBy: 'test',
      reviewedAt: '2026-09-10T00:00:00.000Z',
      verifiedAt: '2026-09-10T00:00:00.000Z',
    },
  ],
};

test('the classifier consults the source register, and consults it first', () => {
  setSourceRegisterForTesting(TEST_REGISTER);
  try {
    // A host nothing else recognizes: without the register it would be `unknown` (authority
    // 0.2), which is what put a state historical society below a crowd-edited marker database.
    assert.equal(classifySourceForConfidence('https://example.com/article'), 'unknown');
    assert.equal(
      classifySourceForConfidence('https://test-archive.example/collections/1'),
      'reputable_secondary',
    );
    // Subdomains of a registered host are covered; look-alikes are not.
    assert.equal(
      classifySourceForConfidence('https://digital.test-archive.example/item/9'),
      'reputable_secondary',
    );
    assert.equal(
      classifySourceForConfidence('https://test-archive.example.evil.example/item/9'),
      'unknown',
    );
    // The register outranks the curated suffix list, including when it grades a host DOWN.
    assert.equal(classifySourceForConfidence('https://www.hmdb.org/m.asp?m=1'), 'news_reportage');
  } finally {
    setSourceRegisterForTesting(undefined);
  }
});

test('classifySourceForConfidence keeps gov and wikipedia behavior', () => {
  assert.equal(classifySourceForConfidence(NPS_GOV), 'government_record');
  assert.equal(classifySourceForConfidence(WIKIPEDIA), 'reputable_secondary');
  assert.equal(classifySourceForConfidence('https://example.com/article'), 'unknown');
});

test('a US patent document grades government_record and high on any mirror, uspto.gov included', () => {
  // The lineage system already treats these as one work (packages/domain-core/src/claims/
  // lineage.ts); the confidence classification has to agree, or the same document grades
  // differently depending on which mirror happened to be fetched.
  assert.equal(
    classifySourceForConfidence('https://patents.google.com/patent/US252386A/en'),
    'government_record',
  );
  assert.equal(confidenceLevelForSource('https://patents.google.com/patent/US252386A/en'), 'high');
  assert.equal(
    classifySourceForConfidence('https://ppubs.uspto.gov/pubwebapp/rest/patents/html/252386'),
    'government_record',
  );
  assert.equal(
    classifySourceForConfidence('https://www.freepatentsonline.com/4723129.html'),
    'government_record',
  );
});

test('a patent mirror search page, listing, or home page is not a government record', () => {
  // Classifying the DOCUMENT, not the mirror: a search query names no document at all.
  assert.notEqual(
    classifySourceForConfidence('https://patents.google.com/?q=latimer'),
    'government_record',
  );
  assert.equal(classifySourceForConfidence('https://patents.google.com/?q=latimer'), 'unknown');
  assert.notEqual(classifySourceForConfidence('https://patents.google.com/'), 'government_record');
});

test('historicsites.dcpreservation.org alone scores 0.7067 — below standardPublish', () => {
  // Below the 0.72 this used to pin: temporalProximity and extractionQuality carry no document
  // date or extraction selector here, so they are unassessed and drop out of the weighted score
  // (renormalized over the remaining components) instead of contributing their old placeholder
  // 0.7/0.8 as though those were measurements.
  const result = computeClaimConfidence('claim-dc-only', [
    { url: DC_PRESERVATION, textContainsSubjectName: true },
  ]);
  assert.equal(result.score, 0.7067);
  assert.equal(result.passesPublishThreshold, false);
  assert.equal(result.threshold, 0.75);
  assert.equal(result.independentLineageCount, 1);
});

test('a record with no document date does not receive a temporalProximity contribution', () => {
  const withoutDate = computeClaimConfidence('claim-no-document-date', [
    { url: DC_PRESERVATION, textContainsSubjectName: true },
  ]);
  // Unassessed: no measurement was averaged in — the component reports 0, and the weighted
  // score renormalizes around the dimensions that were assessed, rather than treating this as
  // a real (if middling) 0.7 the way the old constant did.
  assert.equal(withoutDate.components.temporalProximity, 0);
  assert.equal(withoutDate.score, 0.7067);

  const withDate = computeClaimConfidence('claim-with-document-date', [
    { url: DC_PRESERVATION, textContainsSubjectName: true, documentDate: '1925-04-01' },
  ]);
  // Assessed: the real value is averaged in and its weight re-enters the score. Whether that
  // moves the score up or down depends on whether 0.7 sits above or below the rest of the
  // claim's weighted average, not on presence alone — here it pulls the score down slightly,
  // which is the correct behavior for a renormalized mean, not a sign the wiring is backwards.
  assert.equal(withDate.components.temporalProximity, 0.7);
  assert.notEqual(withDate.score, withoutDate.score);
});

test('a record with no extraction selector does not receive an extractionQuality contribution', () => {
  const withoutSelector = computeClaimConfidence('claim-no-extraction-selector', [
    { url: DC_PRESERVATION, textContainsSubjectName: true },
  ]);
  assert.equal(withoutSelector.components.extractionQuality, 0);
  assert.equal(withoutSelector.score, 0.7067);

  const withSelector = computeClaimConfidence('claim-with-extraction-selector', [
    { url: DC_PRESERVATION, textContainsSubjectName: true, extractionSelector: '.infobox .built' },
  ]);
  assert.equal(withSelector.components.extractionQuality, 0.8);
  assert.equal(withSelector.score, 0.7222);
});

test('dcpreservation + nps.gov clears standardPublish via corroboration', () => {
  const result = computeClaimConfidence('claim-dc-nps', [
    { url: DC_PRESERVATION, textContainsSubjectName: true },
    { url: NPS_GOV, textContainsSubjectName: true },
  ]);
  assert.ok(result.score >= 0.75);
  assert.equal(result.passesPublishThreshold, true);
  assert.equal(result.independentLineageCount, 2);
});

test('dcpreservation + hmdb.org clears standardPublish via tier-2 corroboration', () => {
  const result = computeClaimConfidence('claim-dc-hmdb', [
    { url: DC_PRESERVATION, textContainsSubjectName: true },
    { url: 'https://www.hmdb.org/m.asp?m=12345', textContainsSubjectName: true },
  ]);
  assert.ok(result.score >= 0.75);
  assert.equal(result.passesPublishThreshold, true);
  assert.equal(result.independentLineageCount, 2);
});

test('wikipedia-only scores below a real single source, not level with one', () => {
  // 0.6267, below a lone reputable_secondary host's 0.7067. Those two used to be level (0.66 vs
  // 0.72), which was the tell: a bridge and a heritage-inventory record are not equally good
  // evidence, and the old rule could not say so because it counted a hostname as a lineage.
  // A bridge contributes no corroborating lineage at all, so lineageIndependence is 0 here.
  const result = computeClaimConfidence('claim-wiki-only', [
    { url: WIKIPEDIA, textContainsSubjectName: true },
  ]);
  assert.equal(result.score, 0.6267);
  assert.equal(result.independentLineageCount, 0);
  assert.equal(result.passesPublishThreshold, false);
});

test('adding a bridge to a real source neither lifts nor drags the score', () => {
  // Both halves matter. A bridge must not be what carries a claim over the publish line, and
  // citing one must not PENALISE a record either — that is how "more research made the record
  // less publishable" happened before.
  const npsAlone = computeClaimConfidence('claim-nps', [
    { url: NPS_GOV, textContainsSubjectName: true },
  ]);
  const npsPlusBridge = computeClaimConfidence('claim-nps-wiki', [
    { url: NPS_GOV, textContainsSubjectName: true },
    { url: WIKIPEDIA, textContainsSubjectName: true },
  ]);
  assert.equal(npsPlusBridge.score, npsAlone.score);
  assert.equal(npsPlusBridge.independentLineageCount, 1);
});

test('one authority under two hostnames is one lineage, not two', () => {
  // nps.gov and npgallery.nps.gov are the Park Service twice. Under the hostname rule they
  // corroborated each other.
  const result = computeClaimConfidence('claim-nps-twice', [
    { url: NPS_GOV, textContainsSubjectName: true },
    {
      url: 'https://npgallery.nps.gov/NRHP/GetAsset/NRHP/12345_text',
      textContainsSubjectName: true,
    },
  ]);
  assert.equal(result.independentLineageCount, 1);
});

test('one patent read at the Patent Office and at a mirror is one lineage', () => {
  const result = computeClaimConfidence('claim-patent', [
    { url: 'https://patents.google.com/patent/US252386A/en', textContainsSubjectName: true },
    {
      url: 'https://ppubs.uspto.gov/pubwebapp/x?patentNumber=252386',
      textContainsSubjectName: true,
    },
  ]);
  assert.equal(result.independentLineageCount, 1);
});

test('wikipedia + nps.gov clears standardPublish', () => {
  const result = computeClaimConfidence('claim-wiki-nps', [
    { url: WIKIPEDIA, textContainsSubjectName: true },
    { url: NPS_GOV, textContainsSubjectName: true },
  ]);
  assert.ok(result.score >= 0.75);
  assert.equal(result.passesPublishThreshold, true);
});
