/**
 * Unit tests for related-entity label resolution (never expose raw `ent_*` ids).
 */
import { relatedEntitySubtitle, resolveRelatedEntityLabel } from './related-entity-labels';

describe('resolveRelatedEntityLabel', () => {
  it('returns display name and kind/place for known catalog ids', () => {
    const label = resolveRelatedEntityLabel('ent_dunbar_school_001');
    expect(label.displayName).toBe('Paul Laurence Dunbar High School');
    expect(relatedEntitySubtitle(label)).toBe('School · Washington, D.C.');
  });

  it('never uses the raw entity id as the display title for unknown ids', () => {
    const label = resolveRelatedEntityLabel('ent_unknown_hostile_999');
    expect(label.displayName).toBe('Archive record');
    expect(label.displayName).not.toContain('ent_');
  });
});
