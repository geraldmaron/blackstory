/**
 * One published figure as `bb_reference.statistical_observations` stores it, whichever census table it
 * came from. The ACS and decennial loaders build these; `scripts/lib/lives-nhgis-ingest.ts` writes them.
 * Method: docs/methodology/lives-across-decades.md.
 */
export type LivesPublishedObservation = {
  readonly id: string;
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly boundaryVersion: string;
  readonly referencePeriod: string;
  readonly datasetVintage: string;
  readonly estimate: number;
  readonly marginOfError: number | null;
  readonly numerator: number | null;
  readonly denominator: number | null;
  readonly raceEthnicitySlice: string;
  readonly source: string;
  readonly sourceUrl: string;
  readonly contentHash: string;
  readonly metadata: {
    readonly table: string;
    /** NHGIS table code the figures were extracted under. */
    readonly nhgisTable?: string;
    /** The universe the published table counted, when it is not the series' usual one. */
    readonly universe?: string;
    /** What a reader has to know about this figure: a changed unit, a wider or narrower universe. */
    readonly note?: string;
    readonly numeratorMoe?: number;
    readonly denominatorMoe?: number;
  };
};
