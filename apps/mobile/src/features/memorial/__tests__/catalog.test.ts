/**
 * Unit tests for Memorial catalog helpers.
 */
import {
  filterMemorialNames,
  listMemorialNames,
  loadMemorialCatalog,
  memorialPulse,
  plainDashCopy,
} from '../catalog';

describe('memorial catalog', () => {
  it('loads alphabetical names with incomplete-by-design flag', () => {
    const snapshot = loadMemorialCatalog();
    expect(snapshot.incompleteByDesign).toBe(true);
    expect(snapshot.names.length).toBeGreaterThanOrEqual(50);
    const names = listMemorialNames().map((row) => row.name);
    expect(names).toEqual(
      [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })),
    );
    expect(names).toContain('Trayvon Martin');
  });

  it('links milestone entities where names match', () => {
    const trayvon = listMemorialNames().find((row) => row.name === 'Trayvon Martin');
    expect(trayvon?.entityId).toBe('ent_trayvon_martin_001');
    expect(typeof trayvon?.lat).toBe('number');
    expect(memorialPulse().linkedCount).toBeGreaterThan(0);
  });

  it('keeps the three repo-5jxh names in their correct state', () => {
    const rows = listMemorialNames();

    // He is off the roll entirely: not a victim of police violence but the man who shot a
    // St. Louis sergeant twice in the head on 20 November 2016, killed the next morning firing
    // on the officers who found him. The exported seed must not bring him back.
    expect(rows.find((row) => row.name === 'George Bush III')).toBeUndefined();

    // These two are real victims with no entity record of their own yet. Unlinked is the correct
    // state; a linked one means the exporter matched a namesake (Charles I. Brown of Phi Beta
    // Sigma, or Robert L. Johnson who founded BET and is living).
    for (const name of ['Charles Brown', 'Robert Johnson']) {
      const row = rows.find((candidate) => candidate.name === name);
      expect(row).toBeDefined();
      expect(row?.entityId).toBeUndefined();
    }
  });

  it('filters by query and strips em dashes', () => {
    const hits = filterMemorialNames(listMemorialNames(), 'emmett');
    expect(hits.map((row) => row.name)).toEqual(['Emmett Till']);
    expect(plainDashCopy('A — B')).toBe('A - B');
  });
});
