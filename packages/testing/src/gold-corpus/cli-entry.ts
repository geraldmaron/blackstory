/**
 * Process boundary for the gold-corpus command wrappers.
 */
import { runGoldCorpusCli } from './cli.js';

const mode = process.argv[2];
if (mode !== 'evaluate' && mode !== 'compare') {
  console.error('Expected command mode "evaluate" or "compare".');
  process.exit(2);
}

try {
  process.exitCode = runGoldCorpusCli(mode, process.argv.slice(3));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
