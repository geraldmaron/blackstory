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
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
    expect(names).toContain('Trayvon Martin');
  });

  it('links milestone entities where names match', () => {
    const trayvon = listMemorialNames().find((row) => row.name === 'Trayvon Martin');
    expect(trayvon?.entityId).toBe('ent_trayvon_martin_001');
    expect(typeof trayvon?.lat).toBe('number');
    expect(memorialPulse().linkedCount).toBeGreaterThan(0);
  });

  it('filters by query and strips em dashes', () => {
    const hits = filterMemorialNames(listMemorialNames(), 'emmett');
    expect(hits.map((row) => row.name)).toEqual(['Emmett Till']);
    expect(plainDashCopy('A — B')).toBe('A - B');
  });
});
