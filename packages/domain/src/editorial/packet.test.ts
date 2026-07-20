/**
 * Tests for editorial packet builder and draft validation gates.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadProductConstitution } from '@repo/schemas';
import {
  buildEditorialPacket,
  EDITORIAL_PACKET_KIND,
  type EditorialFieldDraft,
} from './packet.js';
import {
  EDITORIAL_LANGUAGE_PROCEDURAL_STATUS,
  validateEditorialDrafts,
} from './validate.js';

const NOW = '2026-07-18T23:53:00.000Z';

const LONG_SUMMARY =
  'A historically documented Black community school in Harlem with published archival claims ' +
  'and neighborhood mutual-aid networks tied to education and civic life across decades.';

test('buildEditorialPacket derives prose links and optional fields', () => {
  const packet = buildEditorialPacket({
    subjectId: 'entity-1',
    subjectTitle: 'Harlem School',
    decision: 'keep',
    rationale: 'Summary is clear and sourced.',
    confidence: 1.2,
    drafts: {
      publicSummary: `See [[entity-2|Neighbor School]] in context.`,
      relatedEntityIds: ['entity-2'],
    },
    validationIssues: ['needs_image'],
    model: { provider: 'anthropic', modelId: 'claude-test' },
    createdAt: NOW,
    operatorId: 'operator-1',
    sessionId: 'session-1',
  });

  assert.equal(packet.kind, EDITORIAL_PACKET_KIND);
  assert.equal(packet.subjectId, 'entity-1');
  assert.equal(packet.confidence, 1);
  assert.deepEqual(packet.proseLinks, [{ entityId: 'entity-2', label: 'Neighbor School' }]);
  assert.equal(packet.model?.provider, 'anthropic');
  assert.equal(packet.operatorId, 'operator-1');
});

test('validateEditorialDrafts passes a compliant stripped summary', () => {
  const drafts: EditorialFieldDraft = {
    publicSummary: `[[entity-2|Neighbor School]] ${LONG_SUMMARY}`,
  };
  const result = validateEditorialDrafts(drafts);

  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
  assert.ok(result.language);
  assert.equal(result.language.requestedProceduralStatus, EDITORIAL_LANGUAGE_PROCEDURAL_STATUS);
  assert.equal(result.language.evidenceProceduralStatus, EDITORIAL_LANGUAGE_PROCEDURAL_STATUS);
  assert.ok(result.learningSummary);
  assert.equal(result.learningSummary.length, 0);
});

test('validateEditorialDrafts flags short summaries and banned procedural language', () => {
  const policy = loadProductConstitution();
  const banned = policy.unsupportedProceduralLanguage[0] ?? 'guilty as charged';

  const result = validateEditorialDrafts({
    publicSummary: `Too short and ${banned}.`,
    relevanceNote: `Also ${banned} in a note.`,
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.includes('at least')));
  assert.ok(result.issues.some((issue) => issue.includes(banned)));
});

test('validateEditorialDrafts accepts full-field v2 drafts with allowed citations', () => {
  const result = validateEditorialDrafts(
    {
      publicSummary:
        'Shiloh Rosenwald School is a documented Rosenwald Fund school building in Notasulga, ' +
        'Macon County, Alabama, preserved as a public historic site with community support.',
      topicIds: ['education', 'segregation'],
      eraBuckets: ['1910s', '1920s'],
      keywords: ['Rosenwald school'],
      claims: [
        {
          predicate: 'documented_site',
          object: 'NPS documents this as a Rosenwald Fund school building.',
          confidenceLevel: 'high',
          citationSource: 'nps.gov',
          citationHref: 'https://www.nps.gov/places/shiloh-rosenwald-school.htm',
          citationLabel: 'National Park Service',
        },
      ],
    },
    { allowedCitationHrefs: ['https://www.nps.gov/places/shiloh-rosenwald-school.htm'] },
  );
  assert.deepEqual(result.issues, []);
  assert.equal(result.ok, true);
});

test('validateEditorialDrafts rejects fabricated citation hrefs and unknown topics', () => {
  const result = validateEditorialDrafts(
    {
      topicIds: ['not-a-real-topic'],
      eraBuckets: ['nineteen-tens'],
      claims: [
        {
          predicate: 'documented_site',
          object: 'Some claim.',
          confidenceLevel: 'high',
          citationSource: 'nps.gov',
          citationHref: 'https://www.nps.gov/invented-page.htm',
          citationLabel: 'National Park Service',
        },
      ],
    },
    { allowedCitationHrefs: ['https://www.nps.gov/places/real-page.htm'] },
  );
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.includes('not a registered topic id')));
  assert.ok(result.issues.some((issue) => issue.includes('not a decade bucket')));
  assert.ok(result.issues.some((issue) => issue.includes('possible fabrication')));
});

test('validateEditorialDrafts never throws on malformed (non-string) fields from free-model JSON', () => {
  assert.doesNotThrow(() => {
    const result = validateEditorialDrafts(
      {
        // @ts-expect-error simulating a model returning JSON null for a typed-string field
        historicalContext: null,
        // @ts-expect-error simulating a model returning a number instead of a string
        identityLabel: 42,
        topicIds: ['education'],
        claims: [
          {
            // @ts-expect-error simulating a model returning a non-string predicate
            predicate: 7,
            object: 'x',
            confidenceLevel: 'high',
            citationSource: 'nps.gov',
            // @ts-expect-error simulating a model returning null for citationHref
            citationHref: null,
            citationLabel: 'NPS',
          },
        ],
      },
      { allowedCitationHrefs: ['https://www.nps.gov/x'] },
    );
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((issue) => issue.includes('predicate is empty')));
    assert.ok(result.issues.some((issue) => issue.includes('citationHref must be an http(s) URL')));
  });
});
