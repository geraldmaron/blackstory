/**
 * Loads Lives figures TRANSCRIBED BY HAND from a printed federal statistical volume, from a JSON
 * file, into `bb_reference.statistical_observations`.
 *
 * The NHGIS loaders (`ingest-lives-acs.ts`, `ingest-lives-decennial.ts`, `ingest-lives-historical.ts`)
 * cover every figure a machine can fetch. They are not the whole published record. Most of what the
 * census and the education bureaus printed by race and state before 1970 exists only as page images,
 * and docs/research/lives-nhgis-table-map.md records exactly which conditions those are. This is the
 * path for those figures, and it holds them to the same bar: an identified federal agency, a named
 * table, a page a reader can open, and the figure as printed.
 *
 * WHY A SEPARATE LOADER RATHER THAN A BRANCH IN THE NHGIS ONES. Those parse a machine-readable
 * extract and fail loudly when a description moves, which is the right guard for a fetched file and
 * meaningless for a number a person read off a scan. The guard that matters here is different: two
 * independent transcriptions of the same table, reconciled before anything is written. So the shapes
 * stay apart, and `--pass-a` / `--pass-b` below is where the real check lives.
 *
 * DOUBLE ENTRY IS NOT OPTIONAL when two passes are supplied: the loader compares them cell by cell
 * and refuses the whole run on any disagreement, naming every cell that differs. A single pass is
 * accepted only with `--single-pass`, which exists for a figure small enough to verify by eye (one
 * median, say) and prints a warning naming every observation it let through unchecked.
 *
 * Usage (repo root):
 *   set -a && . apps/web/.env.local && set +a
 *   # Two passes, reconciled (the normal case)
 *   node --conditions development --import tsx packages/ops-data/scripts/load-lives-transcribed.ts \
 *     --pass-a=/path/to/pass-a.json --pass-b=/path/to/pass-b.json
 *   # One pass, for a figure verified by eye
 *   node --conditions development --import tsx packages/ops-data/scripts/load-lives-transcribed.ts \
 *     --pass-a=/path/to/one.json --single-pass
 *   # Apply
 *   DRY_RUN=0 LOAD_LIVES_TRANSCRIBED_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/load-lives-transcribed.ts --pass-a=... --pass-b=...
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import {
  buildTranscribedObservations,
  reconcileTranscriptionPasses,
  type TranscribedFigureFile,
} from '../src/lives/transcribed.ts';
import {
  livesSeriesForObservations,
  summarizeLivesObservations,
  upsertLivesObservations,
} from './lib/lives-nhgis-ingest.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const apply = process.env.DRY_RUN === '0' && process.env.LOAD_LIVES_TRANSCRIBED_APPLY === '1';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function readFile(path: string): TranscribedFigureFile {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as TranscribedFigureFile;
  if (!parsed || !Array.isArray(parsed.figures)) {
    throw new Error(`${path}: expected an object with a "figures" array`);
  }
  return parsed;
}

async function main(): Promise<void> {
  const passAPath = arg('pass-a');
  if (!passAPath) throw new Error('--pass-a=<transcription JSON> is required');
  const passBPath = arg('pass-b');
  const singlePass = process.argv.includes('--single-pass');
  if (!passBPath && !singlePass) {
    throw new Error(
      '--pass-b=<second independent transcription> is required. A hand-transcribed table is ' +
        'double-entered before it is written. Pass --single-pass only for a figure small enough ' +
        'to verify by eye, and say so in the run report.',
    );
  }
  if (passBPath && singlePass) throw new Error('--single-pass cannot be combined with --pass-b');

  const passA = readFile(passAPath);
  const observations = passBPath
    ? reconcileTranscriptionPasses(passA, readFile(passBPath))
    : buildTranscribedObservations(passA);

  if (singlePass) {
    console.log(
      `WARNING: single pass, no double entry. ${observations.length} observation(s) written on ` +
        'one reading:',
    );
    for (const observation of observations) {
      console.log(
        `  ${observation.referencePeriod} ${observation.metricId} ${observation.raceEthnicitySlice} ` +
          `${observation.jurisdictionId} = ${observation.estimate}`,
      );
    }
  }

  // Throws on a metric with no Lives series definition or a source without a web link, so both
  // surface in a dry run rather than at write time.
  livesSeriesForObservations(observations);
  console.log(
    JSON.stringify(
      {
        apply,
        source: passA.source,
        table: passA.table,
        ...summarizeLivesObservations(observations),
      },
      null,
      2,
    ),
  );

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = new pg.Pool(normalizePgConnectionString(url));
  try {
    if (!apply) {
      console.log('\nDry run. Set DRY_RUN=0 LOAD_LIVES_TRANSCRIBED_APPLY=1 to write.');
      return;
    }
    // The helper returns the number of SERIES it touched, not observations, so name it that way.
    const seriesWritten = await upsertLivesObservations(pool, observations);
    console.log(`Upserted ${observations.length} observation(s) across ${seriesWritten} series.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
