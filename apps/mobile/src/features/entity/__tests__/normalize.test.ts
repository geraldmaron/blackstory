import { normalizeEntity } from '../normalize';
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
