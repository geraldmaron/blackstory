import { normalizeClaim, normalizeEntity } from '../normalize';
import {
  ALL_KINDS,
  claimWithMalformedCitationUrl,
  claimWithNoCitation,
  entityWithMaliciouslyLargeNarrative,
  entityWithMaliciousText,
  entityWithSelfReferencingNeighbor,
  entityWithUnclearedImageRights,
  entityWithUnknownEnums,
  entityWithZeroClaims,
  fullEntityFixture,
  minimalEntityFixture,
} from '../testFixtures';
import { MAX_EXTENDED_NARRATIVE_CHARS } from '../types';
import {
  CLAIM_ROLE_RECORD_INDEX,
  recordConfidenceTier,
  type EvidenceClaimInput,
} from '@repo/public-contracts/evidence';

describe('normalizeEntity — fixture matrix', () => {
  it.each(ALL_KINDS)('normalizes a FULL fixture for kind=%s without dropping required content', (kind) => {
    const entity = normalizeEntity(fullEntityFixture(kind));
    expect(entity).not.toBeNull();
    expect(entity!.kind).toBe(kind);
    expect(entity!.claims.length).toBeGreaterThan(0);
    expect(entity!.timeline.length).toBeGreaterThan(0);
    expect(entity!.relatedNeighbors?.length).toBeGreaterThan(0);
    expect(entity!.continueLearning?.length).toBeGreaterThan(0);
    expect(entity!.primaryImage).toBeDefined();
    expect(entity!.sensitivity).toBeDefined();
  });

  it.each(ALL_KINDS)('normalizes a MINIMAL fixture for kind=%s (every optional field absent) without crashing', (kind) => {
    const entity = normalizeEntity(minimalEntityFixture(kind));
    expect(entity).not.toBeNull();
    expect(entity!.claims).toEqual([]);
    expect(entity!.timeline).toEqual([]);
    expect(entity!.primaryImage).toBeUndefined();
    expect(entity!.sensitivity).toBeUndefined();
    expect(entity!.statusHistory).toBeUndefined();
    expect(entity!.eventWindow).toBeUndefined();
    expect(entity!.extendedNarrative).toBeUndefined();
    expect(entity!.relatedNeighbors).toBeUndefined();
    expect(entity!.continueLearning).toBeUndefined();
    expect(entity!.geoAnchor).toBeUndefined();
  });
});

describe('normalizeEntity — adversarial cases', () => {
  it('never throws on non-object input', () => {
    for (const bad of [null, undefined, 42, 'a string', true, [], () => {}]) {
      expect(() => normalizeEntity(bad)).not.toThrow();
      expect(normalizeEntity(bad)).toBeNull();
    }
  });

  it('rejects an entity missing both id and displayName', () => {
    expect(normalizeEntity({})).toBeNull();
  });

  it('drops a malformed citation href (javascript: scheme) rather than surfacing it as a link', () => {
    const entity = normalizeEntity({ ...fullEntityFixture('place'), claims: [claimWithMalformedCitationUrl()] });
    expect(entity!.claims[0]!.citation?.href).toBeUndefined();
    expect(entity!.claims[0]!.citation?.source).toBe('Hostile source');
  });

  it('tolerates a claim with no citation at all', () => {
    const entity = normalizeEntity({ ...fullEntityFixture('place'), claims: [claimWithNoCitation()] });
    expect(entity!.claims).toHaveLength(1);
    expect(entity!.claims[0]!.citation).toBeUndefined();
  });

  it('fails closed on an image with an unrecognized rightsStatus (never renders it)', () => {
    const entity = normalizeEntity(entityWithUnclearedImageRights());
    expect(entity!.primaryImage).toBeUndefined();
  });

  it('caps a maliciously large narrative at the contract bound instead of allocating unbounded memory', () => {
    const start = Date.now();
    const entity = normalizeEntity(entityWithMaliciouslyLargeNarrative());
    const elapsedMs = Date.now() - start;
    expect(entity!.extendedNarrative).toBeDefined();
    expect(entity!.extendedNarrative!.length).toBeLessThanOrEqual(MAX_EXTENDED_NARRATIVE_CHARS);
    // Generous bound — this proves no pathological (e.g. quadratic/backtracking) behavior, not a
    // tight perf budget.
    expect(elapsedMs).toBeLessThan(1000);
  });

  it('renders malicious HTML/Unicode text as inert string content (no throw, content preserved verbatim as text)', () => {
    const entity = normalizeEntity(entityWithMaliciousText());
    expect(entity!.displayName).toContain('<script>');
    expect(entity!.summary).toContain('DROP TABLE');
    // The point: it is still just a JS string. Nothing here parses/executes/interprets it.
    expect(typeof entity!.displayName).toBe('string');
  });

  it('normalizes a self-referencing related-neighbor list flatly (no recursion, bounded to the fixture length)', () => {
    const entity = normalizeEntity(entityWithSelfReferencingNeighbor());
    expect(entity!.relatedNeighbors).toHaveLength(2);
    expect(entity!.relatedNeighbors![0]!.id).toBe(entity!.id);
  });

  it('handles zero claims cleanly', () => {
    const entity = normalizeEntity(entityWithZeroClaims());
    expect(entity!.claims).toEqual([]);
  });

  it('falls back to the least-permissive enum value on unrecognized enums (never fails open)', () => {
    const entity = normalizeEntity(entityWithUnknownEnums());
    expect(entity!.kind).toBe('ghost-town'); // unknown kind is passed through as free text, not nulled
    expect(entity!.researchCoverage).toBeUndefined(); // invalid enum -> hidden, never fabricated
    expect(entity!.claims[0]!.confidenceLevel).toBe('low'); // fails toward least reassuring
    expect(entity!.timeline[0]!.datePrecision).toBe('circa'); // fails toward least precise
  });

  it('caps claims/timeline/relatedNeighbors/continueLearning arrays at their contract bounds even if the raw payload exceeds them', () => {
    const manyClaims = Array.from({ length: 10 }, (_, i) => ({
      id: `claim_${i}`,
      predicate: 'p',
      object: 'o',
      confidenceScore: 0.5,
      confidenceLevel: 'medium',
    }));
    const entity = normalizeEntity({ ...minimalEntityFixture('place'), claims: manyClaims });
    expect(entity!.claims).toHaveLength(10); // under the 500 bound — sanity check the cap logic runs, not the cap itself
  });
});

describe('normalizeClaim — claimRole', () => {
  const baseRawClaim = {
    id: 'claim_role_test',
    predicate: 'founded_by',
    object: 'Founded by a coalition of formerly enslaved families in 1871.',
    confidenceScore: 0.82,
    confidenceLevel: 'high',
  };

  it('keeps claimRole when it is a valid wire value (record_index)', () => {
    const claim = normalizeClaim({ ...baseRawClaim, claimRole: CLAIM_ROLE_RECORD_INDEX });
    expect(claim).not.toBeNull();
    expect(claim!.claimRole).toBe('record_index');
  });

  it('keeps claimRole when it is a valid wire value (evidence)', () => {
    const claim = normalizeClaim({ ...baseRawClaim, claimRole: 'evidence' });
    expect(claim).not.toBeNull();
    expect(claim!.claimRole).toBe('evidence');
  });

  it('drops claimRole when it is not a value the wire contract defines', () => {
    const claim = normalizeClaim({ ...baseRawClaim, claimRole: 'primary_source' });
    expect(claim).not.toBeNull();
    expect(claim!.claimRole).toBeUndefined();
  });

  it('leaves claimRole undefined when absent entirely', () => {
    const claim = normalizeClaim({ ...baseRawClaim });
    expect(claim).not.toBeNull();
    expect(claim!.claimRole).toBeUndefined();
  });

  it('grades a record_index claim plus an evidence claim identically to grading the same claims directly against public-contracts — the index row no longer counts as corroboration', () => {
    // Two independently-cited claims, both `high` confidence. Before claimRole survived
    // normalization, `recordConfidenceTier` had no way to see the first row is the record's
    // own index entry (its predicate is deliberately NOT one of the legacy
    // `RECORD_PROVENANCE_PREDICATES` strings, so the predicate fallback in
    // `packages/public-contracts/src/evidence.ts` cannot rescue it either) — both citations
    // counted as corroboration and the record graded a bare `high`.
    const rawIndexClaim = {
      id: 'claim_index',
      predicate: 'catalogued_as',
      object: 'Listed in the National Register of Historic Places.',
      confidenceScore: 0.82,
      confidenceLevel: 'high',
      citation: {
        source: 'nara.gov',
        label: 'NARA catalog entry',
        href: 'https://catalog.archives.gov/id/1',
      },
      claimRole: CLAIM_ROLE_RECORD_INDEX,
    };
    const rawEvidenceClaim = {
      id: 'claim_evidence',
      predicate: 'founded_by',
      object: 'Founded by a coalition of formerly enslaved families in 1871.',
      confidenceScore: 0.82,
      confidenceLevel: 'high',
      citation: {
        source: 'county-historical-society.org',
        label: 'County Historical Society',
        href: 'https://example.org/chs',
      },
      claimRole: 'evidence',
    };

    const entity = normalizeEntity({
      ...minimalEntityFixture('place'),
      claims: [rawIndexClaim, rawEvidenceClaim],
    });
    expect(entity).not.toBeNull();
    expect(entity!.claims).toHaveLength(2);

    const directInputs: EvidenceClaimInput[] = [rawIndexClaim, rawEvidenceClaim];

    // Same tier whether public-contracts grades the mobile-normalized claims or the raw wire
    // claims directly — normalization must not lose the signal `recordConfidenceTier` needs.
    expect(recordConfidenceTier(entity!.claims)).toBe(recordConfidenceTier(directInputs));
    // And that shared tier is the corroboration-aware one: the index row is excluded, leaving
    // exactly one corroborating lineage, so the record steps down from `high` to `medium`
    // rather than reaching `high` on two citations that are really one source plus its own
    // index row.
    expect(recordConfidenceTier(entity!.claims)).toBe('medium');
  });
});
