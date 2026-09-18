/**
 * CPI chaining math for Lives real-income restatement. Browser-safe; no Node imports.
 * Annual series live in lives-cpi-annual.ts. Method: docs/methodology/lives-across-decades.md.
 */

/** Annual average index values keyed by calendar year. */
export type AnnualIndex = Readonly<Record<number, number>>;

export const CPI_U_RS_LINK_YEAR = 1978;

/**
 * One index covering every year either input covers: CPI-U-RS where it exists (from the link
 * year), and CPI-U rescaled to CPI-U-RS for earlier years.
 */
export function chainCpiUrs(input: {
  readonly cpiU: AnnualIndex;
  readonly cpiURs: AnnualIndex;
  readonly linkYear?: number;
}): AnnualIndex {
  const linkYear = input.linkYear ?? CPI_U_RS_LINK_YEAR;
  const uAtLink = input.cpiU[linkYear];
  const rsAtLink = input.cpiURs[linkYear];
  if (!(uAtLink && uAtLink > 0) || !(rsAtLink && rsAtLink > 0)) {
    throw new Error(`both indexes need a positive value at link year ${linkYear}`);
  }
  const scale = rsAtLink / uAtLink;
  const chained: Record<number, number> = {};
  for (const [yearText, value] of Object.entries(input.cpiU)) {
    const year = Number(yearText);
    if (year < linkYear) chained[year] = value * scale;
  }
  for (const [yearText, value] of Object.entries(input.cpiURs)) {
    const year = Number(yearText);
    if (year >= linkYear) chained[year] = value;
  }
  return chained;
}

/** Restates an amount from one year's dollars in another year's dollars. */
export function toYearDollars(
  amount: number,
  fromYear: number,
  toYear: number,
  index: AnnualIndex,
): number {
  const from = index[fromYear];
  const to = index[toYear];
  if (!(from && from > 0)) throw new Error(`no index value for ${fromYear}`);
  if (!(to && to > 0)) throw new Error(`no index value for ${toYear}`);
  return (amount * to) / from;
}
