/**
 * Themes catalog loader and filter tests.
 */
import {
  catalogPulse,
  filterCatalogRows,
  getThemeById,
  listCatalogRows,
  listPacketsForTheme,
  listP0Rows,
  listP1Rows,
  loadThemesCatalog,
  parseThemeId,
  plainDashCopy,
} from '../catalog';

describe('themes catalog', () => {
  it('loads themes and packets exported from the active Supabase release', () => {
    const snap = loadThemesCatalog();
    expect(snap.themes.length).toBeGreaterThanOrEqual(7);
    expect(snap.packets.length).toBeGreaterThanOrEqual(11);
    // Seed is exported from bb_public.release_theme_impact_packets, never a
    // committed fixture — that is what keeps unreleased packets out of the app.
    expect(snap.source).toBe('supabase-active-release');
    expect(snap.releaseId).toMatch(/^rel_/);
    expect(snap.packets.every((packet) => packet.dataSource === 'release')).toBe(true);
    expect(snap.releaseLabel.length).toBeGreaterThan(0);
  });

  it('lists P0 and P1 rows with packet counts', () => {
    const rows = listCatalogRows();
    const p0 = listP0Rows(rows);
    const p1 = listP1Rows(rows);
    expect(p0.some((row) => row.id === 'redlining')).toBe(true);
    expect(p1.some((row) => row.id === 'voting_rights')).toBe(true);
    expect(p0.every((row) => row.packetCount > 0)).toBe(true);
  });

  it('filters by title and strips unicode dashes in copy', () => {
    const rows = filterCatalogRows(listCatalogRows(), 'redlining');
    expect(rows.map((row) => row.id)).toEqual(['redlining']);
    expect(plainDashCopy('Black–White')).toBe('Black to White');
  });

  it('resolves theme detail packets', () => {
    expect(getThemeById('drug_policy_state')?.priority).toBe('P0');
    const packets = listPacketsForTheme('redlining');
    expect(packets.length).toBeGreaterThanOrEqual(3);
    expect(packets.every((p) => p.themeId === 'redlining')).toBe(true);
  });

  it('reports catalog pulse', () => {
    const pulse = catalogPulse();
    expect(pulse.themeCount).toBeGreaterThanOrEqual(7);
    expect(pulse.packetCount).toBeGreaterThanOrEqual(11);
    expect(pulse.p0Count).toBe(2);
  });

  it('parses theme ids defensively', () => {
    expect(parseThemeId('redlining')).toBe('redlining');
    expect(parseThemeId('drug_policy_state')).toBe('drug_policy_state');
    expect(parseThemeId('../evil')).toBeNull();
    expect(parseThemeId('')).toBeNull();
  });
});
