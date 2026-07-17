/**
 * Dry-run-first command implementation for corpus evaluation and before/after reports.
 * Output is written only when an explicit --out path is supplied.
 */
import { writeFileSync } from 'node:fs';
import { evaluateCorpus } from './metrics.js';
import { loadGoldCorpus, loadGoldPredictions } from './load.js';
import { generateBeforeAfterReport } from './report.js';

type CliMode = 'evaluate' | 'compare';

const HELP: Record<CliMode, string> = {
  evaluate: `Usage: eval.mjs --corpus <file> --predictions <file> [--evaluated-at <ISO>] [--out <file>]

Evaluates one algorithm prediction set. Defaults to dry-run JSON on stdout.`,
  compare: `Usage: before-after.mjs --corpus <file> --before <file> --after <file> [--evaluated-at <ISO>] [--out <file>]

Compares two algorithm prediction sets against one corpus. Defaults to dry-run JSON on stdout.`,
};

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function requiredOption(args: readonly string[], name: string): string {
  const value = option(args, name);
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Missing required option ${name}.`);
  }
  return value;
}

export function runGoldCorpusCli(
  mode: CliMode,
  args: readonly string[],
  io: { readonly log: (message: string) => void } = console,
): number {
  if (args.includes('--help') || args.includes('-h')) {
    io.log(HELP[mode]);
    return 0;
  }
  const corpus = loadGoldCorpus(requiredOption(args, '--corpus'));
  const evaluatedAt = option(args, '--evaluated-at') ?? new Date().toISOString();
  const result =
    mode === 'evaluate'
      ? evaluateCorpus({
          corpus,
          predictions: loadGoldPredictions(requiredOption(args, '--predictions')),
          evaluatedAt,
        })
      : generateBeforeAfterReport({
          before: evaluateCorpus({
            corpus,
            predictions: loadGoldPredictions(requiredOption(args, '--before')),
            evaluatedAt,
          }),
          after: evaluateCorpus({
            corpus,
            predictions: loadGoldPredictions(requiredOption(args, '--after')),
            evaluatedAt,
          }),
          generatedAt: evaluatedAt,
        });
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  const outputPath = option(args, '--out');
  if (outputPath === undefined) io.log(serialized.trimEnd());
  else writeFileSync(outputPath, serialized, { encoding: 'utf8', flag: 'wx' });
  return 0;
}
