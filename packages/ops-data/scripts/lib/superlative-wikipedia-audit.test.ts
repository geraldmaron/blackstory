/**
 * repo-z97f — pins the exact defect the William F. Penn record shipped with (repo-wqtq): a
 * `first_to_do_x` basis record whose only resolvable evidence is Wikipedia. Each case below is a
 * boundary this audit has to get right, not a restatement of the implementation.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  auditSuperlativeWikipediaOnly,
  hostOfClaim,
  isWikipediaHost,
  summarizeFindings,
  type AuditEntity,
} from './superlative-wikipedia-audit.ts';

function penn(overrides: Partial<AuditEntity> = {}): AuditEntity {
  return {
    entityId: 'civil-rights-leaders-william-f-penn',
    displayName: 'William F. Penn',
    kind: 'person',
    summary: 'Penn was the first African American to graduate from Yale Medical School (1897).',
    claims: [
      {
        id: 'claim-1',
        predicate: 'graduated',
        object: 'first African American to graduate from Yale Medical School',
        citationHref: 'https://en.wikipedia.org/wiki/William_F._Penn',
        citationSource: 'Wikipedia',
      },
    ],
    notabilityBasis: [
      {
        criterion: 'first_to_do_x',
        note: 'First African American to graduate from Yale Medical School (1897).',
        evidenceIds: ['claim-1'],
      },
    ],
    ...overrides,
  };
}

describe('isWikipediaHost', () => {
  it('matches the bare and www hosts', () => {
    assert.equal(isWikipediaHost('en.wikipedia.org'), true);
    assert.equal(isWikipediaHost('wikipedia.org'), true);
  });

  it('does not match a host that merely contains the word', () => {
    // "wikipediafoundation.org" is a real distinct domain; a substring match would misclassify it.
    assert.equal(isWikipediaHost('wikipediafoundation.org'), false);
  });

  it('does not match wikidata, a different bridge source entirely', () => {
    assert.equal(isWikipediaHost('www.wikidata.org'), false);
  });
});

describe('hostOfClaim', () => {
  it('reads the host from citationHref when present', () => {
    assert.equal(
      hostOfClaim({ id: 'c1', citationHref: 'https://www.yale.edu/exhibit', citationSource: 'x' }),
      'yale.edu',
    );
  });

  it('falls back to citationSource when there is no href', () => {
    assert.equal(hostOfClaim({ id: 'c1', citationSource: 'Wikipedia' }), 'wikipedia');
  });
});

describe('auditSuperlativeWikipediaOnly', () => {
  it('flags a first_to_do_x basis record resting on Wikipedia alone', () => {
    const findings = auditSuperlativeWikipediaOnly([penn()]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.entityId, 'civil-rights-leaders-william-f-penn');
    assert.equal(findings[0]?.criterion, 'first_to_do_x');
    assert.deepEqual(findings[0]?.citedHosts, ['en.wikipedia.org']);
  });

  it('does NOT flag the same basis once an institutional source is added', () => {
    // The corrected record: Library of Congress evidence added alongside Wikipedia.
    const corrected = penn({
      claims: [
        ...penn().claims,
        {
          id: 'claim-2',
          predicate: 'graduated',
          object: 'first African American to graduate from Yale Medical School',
          citationHref: 'https://www.loc.gov/item/naacp-atlanta-officers-1917',
          citationSource: 'Library of Congress',
        },
      ],
      notabilityBasis: [
        {
          criterion: 'first_to_do_x',
          note: 'First African American to graduate from Yale Medical School (1897).',
          evidenceIds: ['claim-1', 'claim-2'],
        },
      ],
    });
    assert.deepEqual(auditSuperlativeWikipediaOnly([corrected]), []);
  });

  it('ignores criteria outside first_to_do_x / only_or_oldest even when Wikipedia-only', () => {
    const otherCriterion = penn({
      notabilityBasis: [
        {
          criterion: 'community_anchor',
          note: 'A long-standing anchor institution.',
          evidenceIds: ['claim-1'],
        },
      ],
    });
    assert.deepEqual(auditSuperlativeWikipediaOnly([otherCriterion]), []);
  });

  it('reports entityHasNonWikipediaClaimElsewhere honestly per entity, not per basis record', () => {
    // The superlative basis itself is Wikipedia-only, but the entity carries an unrelated claim
    // with a non-Wikipedia citation. That claim does not corroborate the superlative — the finding
    // must still fire — but the record is not "zero non-Wikipedia evidence" either.
    const withUnrelatedClaim = penn({
      claims: [
        ...penn().claims,
        {
          id: 'claim-3',
          predicate: 'born',
          object: 'Atlanta, Georgia',
          citationHref: 'https://www.loc.gov/item/some-other-record',
          citationSource: 'Library of Congress',
        },
      ],
    });
    const findings = auditSuperlativeWikipediaOnly([withUnrelatedClaim]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.entityHasNonWikipediaClaimElsewhere, true);
  });

  it('flags the superlative reaching the published summary, with an excerpt', () => {
    const findings = auditSuperlativeWikipediaOnly([penn()]);
    assert.equal(findings[0]?.summaryCarriesSuperlative, true);
    assert.match(findings[0]?.summaryExcerpt ?? '', /first African American/);
  });

  it('does not flag summaryCarriesSuperlative when the summary was already softened', () => {
    const softened = penn({ summary: 'Penn earned his MD at Yale School of Medicine in 1897.' });
    const findings = auditSuperlativeWikipediaOnly([softened]);
    assert.equal(findings.length, 1); // basis + evidence are unchanged, still Wikipedia-only
    assert.equal(findings[0]?.summaryCarriesSuperlative, false);
    assert.equal(findings[0]?.summaryExcerpt, undefined);
  });

  it('reports dangling evidenceIds without treating the row as evidence-free', () => {
    const withDangling = penn({
      notabilityBasis: [
        {
          criterion: 'first_to_do_x',
          note: 'First African American to graduate from Yale Medical School (1897).',
          evidenceIds: ['claim-1', 'claim-missing'],
        },
      ],
    });
    const findings = auditSuperlativeWikipediaOnly([withDangling]);
    assert.equal(findings.length, 1);
    assert.deepEqual(findings[0]?.danglingEvidenceIds, ['claim-missing']);
    assert.deepEqual(findings[0]?.resolvedClaimIds, ['claim-1']);
  });

  it('does not report a basis record whose evidenceIds are entirely dangling', () => {
    // Zero resolvable evidence is a different, worse defect (the publish gate is supposed to
    // refuse it outright) — not "cited to Wikipedia only". Conflating the two would hide it.
    const allDangling = penn({
      notabilityBasis: [
        {
          criterion: 'first_to_do_x',
          note: 'First African American to graduate from Yale Medical School (1897).',
          evidenceIds: ['claim-missing'],
        },
      ],
    });
    assert.deepEqual(auditSuperlativeWikipediaOnly([allDangling]), []);
  });

  it('treats each qualifying basis record on an entity independently', () => {
    const twoBasisRecords = penn({
      claims: [
        ...penn().claims,
        {
          id: 'claim-only',
          predicate: 'operated',
          object: 'the only Black-owned pharmacy in the county',
          citationHref: 'https://en.wikipedia.org/wiki/Some_Pharmacy',
          citationSource: 'Wikipedia',
        },
      ],
      notabilityBasis: [
        ...penn().notabilityBasis,
        {
          criterion: 'only_or_oldest',
          note: 'Operated the only Black-owned pharmacy in the county.',
          evidenceIds: ['claim-only'],
        },
      ],
    });
    const findings = auditSuperlativeWikipediaOnly([twoBasisRecords]);
    assert.equal(findings.length, 2);
    assert.deepEqual(findings.map((f) => f.criterion).sort(), ['first_to_do_x', 'only_or_oldest']);
  });
});

describe('summarizeFindings', () => {
  it('matches the bead-defined counts across a small mixed cohort', () => {
    const uncorroboratedNoOtherClaim = penn();
    const corroboratedElsewhere = penn({
      entityId: 'other-entity',
      displayName: 'Other Entity',
      claims: [
        ...penn().claims,
        {
          id: 'claim-2',
          predicate: 'born',
          object: 'elsewhere',
          citationHref: 'https://www.si.edu/exhibit',
          citationSource: 'Smithsonian',
        },
      ],
      summary: 'A record with a softened, non-superlative summary sentence about their life.',
    });
    const summary = summarizeFindings(
      auditSuperlativeWikipediaOnly([uncorroboratedNoOtherClaim, corroboratedElsewhere]),
    );
    assert.equal(summary.totalFindingRows, 2);
    assert.equal(summary.distinctEntities, 2);
    assert.equal(summary.byCriterion.first_to_do_x, 2);
    assert.equal(summary.byCriterion.only_or_oldest, 0);
    assert.equal(summary.noNonWikipediaClaimAtAll, 1); // only the Penn-shaped one
    assert.equal(summary.reachesPublishedSummary, 1); // only the un-softened one
  });
});
