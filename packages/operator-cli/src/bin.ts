#!/usr/bin/env node

/**
 * Live entrypoint: only this file touches `process.argv`/`process.exit`. Everything else in
 * this package is a pure or dependency-injected function, unit-testable without a real process.
 */
import { runCli } from './cli.js';

const exitCode = await runCli(process.argv.slice(2));
process.exit(exitCode);
