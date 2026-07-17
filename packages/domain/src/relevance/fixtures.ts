/**
 * Relevance fixture loading for gold calibration cases.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RelevanceFixture, RelevanceFixtureCase } from './types.js';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export const RELEVANCE_GOLD_FIXTURE_PATH = join(FIXTURES_DIR, 'relevance-gold-fixture.v1.json');

export function parseRelevanceFixture(raw: unknown): RelevanceFixture {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Relevance fixture must be an object.');
  }
  const value = raw as Partial<RelevanceFixture>;
  if (value.schemaVersion !== 'relevance-fixture.v1') {
    throw new Error(`Unsupported relevance fixture schema: ${String(value.schemaVersion)}`);
  }
  if (!value.description || !Array.isArray(value.cases) || value.cases.length === 0) {
    throw new Error('Relevance fixture requires description and non-empty cases.');
  }
  return value as RelevanceFixture;
}

export function loadRelevanceGoldFixture(): RelevanceFixture {
  const raw = JSON.parse(readFileSync(RELEVANCE_GOLD_FIXTURE_PATH, 'utf8')) as unknown;
  return parseRelevanceFixture(raw);
}

export function getRelevanceFixtureCase(id: string): RelevanceFixtureCase {
  const fixture = loadRelevanceGoldFixture();
  const found = fixture.cases.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`Relevance fixture case not found: ${id}`);
  }
  return found;
}
