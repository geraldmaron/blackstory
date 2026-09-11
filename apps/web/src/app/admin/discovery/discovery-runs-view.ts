/**
 * Pure view helpers for the discovery campaign runs desk table.
 */
export type DiscoveryRunRow = {
  readonly survivors?: number;
};

/** Survivors counts are optional on each run; the column appears because the row type defines `survivors`. */
export function shouldShowSurvivorsColumn(_rows: readonly DiscoveryRunRow[]): boolean {
  return true;
}

export function formatSurvivorCount(value: number | undefined): string {
  if (value === undefined) return '—';
  return String(value);
}
