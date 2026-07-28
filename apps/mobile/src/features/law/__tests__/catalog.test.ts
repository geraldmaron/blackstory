/**
 * Unit tests for Law catalog helpers.
 */
import {
  catalogPulse,
  filterCatalogRows,
  getLawBySlug,
  listCatalogRows,
  loadLawCatalog,
  parseLawSlug,
  plainDashCopy,
} from '../catalog';

describe('law catalog', () => {
  it('loads seeded entries with explainers', () => {
    const snapshot = loadLawCatalog();
    expect(snapshot.entries.length).toBeGreaterThanOrEqual(10);
    expect(getLawBySlug('civil-rights-act-1964')?.explainer?.whatItSays).toMatch(/Civil Rights Act/i);
    expect(catalogPulse(snapshot).explainerCount).toBeGreaterThan(0);
  });

  it('filters by query and kind', () => {
    const rows = listCatalogRows();
    const voting = filterCatalogRows(rows, 'voting');
    expect(voting.some((row) => /Voting Rights/i.test(row.title))).toBe(true);
    const cases = filterCatalogRows(rows, '', 'landmark-case');
    expect(cases.every((row) => row.kind === 'landmark-case')).toBe(true);
    expect(cases.length).toBeGreaterThan(0);
  });

  it('strips em dashes and validates slugs', () => {
    expect(plainDashCopy('A — B')).toBe('A - B');
    expect(parseLawSlug('Brown-v-Board-of-Education')).toBe('brown-v-board-of-education');
    expect(parseLawSlug('../evil')).toBeNull();
  });

  it('carries canonical entity ids that exist in the Supabase release', () => {
    // Seed is exported from bb_public.release_legal_snapshots, and the loader
    // rejects any link absent from the active release, so no ent_seed_* fictions.
    const cra = getLawBySlug('civil-rights-act-1964');
    expect(cra?.canonicalEntityId).toBe('ent_law_civil_rights_act_1964');
    expect(
      loadLawCatalog().entries.every(
        (entry) => !entry.canonicalEntityId?.startsWith('ent_seed_'),
      ),
    ).toBe(true);
  });
});
