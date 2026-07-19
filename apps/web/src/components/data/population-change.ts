/**
 * Pure formatters for decade-over-decade Black population change on `/data`.
 * Charts keep absolute levels; the stat strip shows Δ Black and Δ share only.
 */
export type PopulationChangeLike = {
  readonly fromDecade: string;
  readonly toDecade: string;
  readonly blackAbsoluteChange: number;
  readonly blackPercentChange: number | null;
  readonly shareChangePp: number;
  readonly source: string;
  readonly sourceUrl: string;
};

export type StateChangeLike = {
  readonly stateFips: string;
  readonly stateName?: string;
  readonly blackAbsoluteChange: number;
  readonly shareChangePp: number;
  readonly blackPopulationTo: number;
};

function formatSignedCount(value: number): string {
  const abs = Math.abs(value).toLocaleString('en-US');
  if (value > 0) return `+${abs}`;
  if (value < 0) return `−${abs}`;
  return abs;
}

function formatSignedPp(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const abs = Math.abs(rounded).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  if (rounded > 0) return `+${abs} pp`;
  if (rounded < 0) return `−${abs} pp`;
  return `${abs} pp`;
}

function formatPercentChange(value: number | null): string | undefined {
  if (value === null) return undefined;
  const rounded = Math.round(value * 10) / 10;
  const abs = Math.abs(rounded).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  if (rounded > 0) return `+${abs}%`;
  if (rounded < 0) return `−${abs}%`;
  return `${abs}%`;
}

/** Strip items for national adjacent-decade changes (Δ Black + Δ share). */
export function nationalChangeStripItems(changes: readonly PopulationChangeLike[]): Array<{
  readonly id: string;
  readonly value: string;
  readonly label: string;
  readonly note: string;
  readonly sources: readonly [{ readonly label: string; readonly url: string }];
}> {
  return changes.map((change) => {
    const pct = formatPercentChange(change.blackPercentChange);
    const noteParts = [
      `Share of total population ${formatSignedPp(change.shareChangePp)}`,
      ...(pct ? [`Black population ${pct}`] : []),
    ];
    return {
      id: `${change.fromDecade}-${change.toDecade}`,
      value: formatSignedCount(change.blackAbsoluteChange),
      label: `Black population change, ${change.fromDecade}→${change.toDecade}`,
      note: noteParts.join(' · '),
      sources: [{ label: change.source, url: change.sourceUrl }],
    };
  });
}

/** Top movers by absolute Black population change (gains first, then losses). */
export function rankStateMovers(
  changes: readonly StateChangeLike[],
  limit = 8,
): {
  readonly gains: readonly StateChangeLike[];
  readonly losses: readonly StateChangeLike[];
} {
  const gains = [...changes]
    .filter((row) => row.blackAbsoluteChange > 0)
    .sort((a, b) => b.blackAbsoluteChange - a.blackAbsoluteChange)
    .slice(0, limit);
  const losses = [...changes]
    .filter((row) => row.blackAbsoluteChange < 0)
    .sort((a, b) => a.blackAbsoluteChange - b.blackAbsoluteChange)
    .slice(0, limit);
  return { gains, losses };
}

export function formatStateChangeLine(row: StateChangeLike, stateName: string): string {
  return `${stateName}: ${formatSignedCount(row.blackAbsoluteChange)} Black population (${formatSignedPp(row.shareChangePp)} share)`;
}
