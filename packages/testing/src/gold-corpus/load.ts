/**
 * Loads versioned gold-corpus and prediction JSON files from local disk for tests and
 * dry-run command-line evaluation.
 */
import { readFileSync } from 'node:fs';
import type { GoldCorpus, GoldPredictions } from './types.js';
import { GOLD_CORPUS_SCHEMA_VERSION, GOLD_PREDICTIONS_SCHEMA_VERSION } from './types.js';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

export function loadGoldCorpus(path: string): GoldCorpus {
  const value = readJson(path);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== GOLD_CORPUS_SCHEMA_VERSION ||
    !('examples' in value) ||
    !Array.isArray(value.examples)
  ) {
    throw new Error(`Invalid gold corpus at ${path}.`);
  }
  return value as GoldCorpus;
}

export function loadGoldPredictions(path: string): GoldPredictions {
  const value = readJson(path);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== GOLD_PREDICTIONS_SCHEMA_VERSION ||
    !('predictions' in value) ||
    !Array.isArray(value.predictions)
  ) {
    throw new Error(`Invalid gold predictions at ${path}.`);
  }
  return value as GoldPredictions;
}
