/**
 * Figures transcribed by hand from a printed federal statistical volume, turned into the same
 * observations the NHGIS loaders produce. Pure: the script reads the JSON and writes the rows.
 *
 * Most of what was published by race and state before 1970 exists only as page images, so the
 * timeline cannot fetch it. What it can do is hold a transcription to the same standard as an
 * extract, and the standard here is double entry: two people (or two agents) read the same table
 * without seeing each other's work, and every cell has to agree before anything is written.
 *
 * That check is the whole point of this module, so it is deliberately unforgiving. A disagreement
 * is not resolved, averaged, or rounded away — the run refuses and names every cell. A transcription
 * where one pass read a 1900 column into a 1910 slot is exactly the failure this catches, and it is
 * invisible to every other guard in the pipeline, because both numbers are plausible.
 *
 * Method: docs/methodology/lives-across-decades.md. Source rules: docs/research/lives-source-authority.md.
 */
import { createHash } from 'node:crypto';
import type { LivesPublishedObservation } from './published-observation.js';

/** One figure as a transcriber read it off the page. */
export type TranscribedFigure = {
  /** Series id from LIVES_SERIES, or an income-bracket id. */
  readonly metricId: string;
  /** `nation:US` or `state:NN`. */
  readonly jurisdictionId: string;
  /** Census year as the timeline stores it: "1910", "1970". */
  readonly referencePeriod: string;
  /** Canonical slice: black, white, nonwhite, hispanic, all, spanish_origin... */
  readonly raceEthnicitySlice: string;
  /**
   * The figure as printed. A rate is stored as the percentage the table printed; a count pair is
   * stored as numerator and denominator and the estimate is the share they make.
   */
  readonly estimate: number;
  readonly numerator?: number | null;
  readonly denominator?: number | null;
  /** The universe the table counted, when it is not the series' usual one. */
  readonly universe?: string;
  /** What a reader has to know: a changed unit, a restricted coverage, a definition break. */
  readonly note?: string;
};

/** The volume a set of figures was read from, cited once for all of them. */
export type TranscribedFigureFile = {
  /** How a citation names the publication. */
  readonly source: string;
  /** A page a reader can open. */
  readonly sourceUrl: string;
  /** The table as the volume numbers it, e.g. "Table 42". */
  readonly table: string;
  /** Printed page or page range, e.g. "189-195". */
  readonly page: string;
  /** Boundary version for the geography these figures describe. */
  readonly boundaryVersion: string;
  /** Dataset vintage recorded on every row, e.g. "1913 printed volume". */
  readonly datasetVintage: string;
  readonly figures: readonly TranscribedFigure[];
};

function figureKey(figure: TranscribedFigure): string {
  return [
    figure.referencePeriod,
    figure.metricId,
    figure.jurisdictionId,
    figure.raceEthnicitySlice,
  ].join('|');
}

function observationId(file: TranscribedFigureFile, figure: TranscribedFigure): string {
  const hash = createHash('sha256')
    .update(`${file.source}|${file.table}|${figureKey(figure)}`)
    .digest('hex')
    .slice(0, 16);
  return `lives-tr-${hash}`;
}

function contentHash(file: TranscribedFigureFile, figure: TranscribedFigure): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        file.source,
        file.table,
        file.page,
        figureKey(figure),
        figure.estimate,
        figure.numerator ?? null,
        figure.denominator ?? null,
      ]),
    )
    .digest('hex');
}

/** Every figure in one pass, as observations. Throws on a duplicate cell within the pass. */
export function buildTranscribedObservations(
  file: TranscribedFigureFile,
): LivesPublishedObservation[] {
  if (!/^https:\/\//u.test(file.sourceUrl)) {
    throw new Error(`source must carry an https page a reader can open: ${file.sourceUrl}`);
  }
  const seen = new Set<string>();
  return file.figures.map((figure) => {
    const key = figureKey(figure);
    if (seen.has(key)) throw new Error(`duplicate cell in one pass: ${key}`);
    seen.add(key);
    if (!Number.isFinite(figure.estimate)) {
      throw new Error(`${key}: estimate is not a number`);
    }
    return {
      id: observationId(file, figure),
      metricId: figure.metricId,
      jurisdictionId: figure.jurisdictionId,
      boundaryVersion: file.boundaryVersion,
      referencePeriod: figure.referencePeriod,
      datasetVintage: file.datasetVintage,
      estimate: figure.estimate,
      marginOfError: null,
      numerator: figure.numerator ?? null,
      denominator: figure.denominator ?? null,
      raceEthnicitySlice: figure.raceEthnicitySlice,
      source: file.source,
      sourceUrl: file.sourceUrl,
      contentHash: contentHash(file, figure),
      metadata: {
        table: `${file.table}, p. ${file.page}`,
        ...(figure.universe === undefined ? {} : { universe: figure.universe }),
        ...(figure.note === undefined ? {} : { note: figure.note }),
      },
    };
  });
}

export type TranscriptionDisagreement = {
  readonly cell: string;
  readonly field: string;
  readonly passA: number | null | undefined;
  readonly passB: number | null | undefined;
};

/**
 * Both passes, reconciled. Every cell must appear in both and agree on every value, or the whole
 * run is refused: a partial write from a disputed transcription is worse than no write, because the
 * rows that did land carry no sign that the table they came from was in doubt.
 */
export function reconcileTranscriptionPasses(
  passA: TranscribedFigureFile,
  passB: TranscribedFigureFile,
): LivesPublishedObservation[] {
  if (passA.table !== passB.table || passA.source !== passB.source) {
    throw new Error(
      `the two passes describe different tables: "${passA.source} ${passA.table}" against ` +
        `"${passB.source} ${passB.table}"`,
    );
  }
  const byKeyA = new Map(passA.figures.map((figure) => [figureKey(figure), figure]));
  const byKeyB = new Map(passB.figures.map((figure) => [figureKey(figure), figure]));

  const onlyA = [...byKeyA.keys()].filter((key) => !byKeyB.has(key));
  const onlyB = [...byKeyB.keys()].filter((key) => !byKeyA.has(key));
  const disagreements: TranscriptionDisagreement[] = [];
  for (const [key, a] of byKeyA) {
    const b = byKeyB.get(key);
    if (!b) continue;
    for (const field of ['estimate', 'numerator', 'denominator'] as const) {
      const left = a[field] ?? null;
      const right = b[field] ?? null;
      if (left !== right) disagreements.push({ cell: key, field, passA: left, passB: right });
    }
  }

  if (onlyA.length > 0 || onlyB.length > 0 || disagreements.length > 0) {
    const lines = [
      `Transcription passes disagree; nothing was written. ${disagreements.length} cell(s) differ, ` +
        `${onlyA.length} only in pass A, ${onlyB.length} only in pass B.`,
      ...disagreements.map(
        (d) => `  ${d.cell} ${d.field}: A=${String(d.passA)} B=${String(d.passB)}`,
      ),
      ...onlyA.map((key) => `  only in pass A: ${key}`),
      ...onlyB.map((key) => `  only in pass B: ${key}`),
      'Re-read the page for each cell above. Do not average, round, or pick a side.',
    ];
    throw new Error(lines.join('\n'));
  }
  return buildTranscribedObservations(passA);
}
