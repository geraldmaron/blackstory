/**
 * Unit tests for v6 kind-family encoding (mobile Explore map parity with web).
 */
import {
  displayEncodingFor,
  kindFamilyFor,
  kindFamilyEncodingForKind,
  MAP_KIND_FAMILY_ENCODING,
} from '../kind-encoding';

describe('kindFamilyFor', () => {
  it('maps micro-kinds to five families', () => {
    expect(kindFamilyFor('person')).toBe('people');
    expect(kindFamilyFor('school')).toBe('places');
    expect(kindFamilyFor('movement')).toBe('organizations');
    expect(kindFamilyFor('case')).toBe('events');
    expect(kindFamilyFor('publication')).toBe('sources');
  });
});

describe('displayEncodingFor', () => {
  it('uses family shade and micro-kind glyph', () => {
    const school = displayEncodingFor('school');
    expect(school.shade).toBe(kindFamilyEncodingForKind('school').shade);
    expect(school.glyph).toBe('square');
  });

  it('prefers semantic tone shade while keeping glyph', () => {
    const encoded = displayEncodingFor('place', 'massacre');
    expect(encoded.label).toContain('Massacre');
    expect(encoded.glyph).toBe('circle');
  });
});

describe('MAP_KIND_FAMILY_ENCODING', () => {
  it('lists five families matching web v6', () => {
    expect(Object.keys(MAP_KIND_FAMILY_ENCODING)).toEqual([
      'people',
      'places',
      'organizations',
      'events',
      'sources',
    ]);
  });
});
