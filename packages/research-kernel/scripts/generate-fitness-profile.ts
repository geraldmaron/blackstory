import { readFileSync, writeFileSync } from 'node:fs';
import { blackStorySourceFitnessRules } from '../../domain-core/src/claims/source-fitness.js';
const path = new URL('../profiles/black-history.v1.json', import.meta.url);
const profile = JSON.parse(readFileSync(path, 'utf8'));
const expected = blackStorySourceFitnessRules();
if (process.argv.includes('--check')) {
  if (JSON.stringify(profile.sourceFitness) !== JSON.stringify(expected))
    throw new Error('BlackStory source fitness profile is stale; run generate');
} else {
  profile.sourceFitness = expected;
  profile.version = '1.2.0';
  writeFileSync(path, JSON.stringify(profile, null, 2) + '\n');
}
