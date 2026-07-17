#!/usr/bin/env node
/**
 * CLI: assert automatic App Hosting rollouts remain disabled (ADR-006 acceptance criterion #1).
 */
import { assertNoAutomaticRollouts } from './lib/auto-rollout-guard.mjs';

const result = await assertNoAutomaticRollouts();
for (const warning of result.warnings) {
  console.warn(`WARN: ${warning}`);
}
if (!result.ok) {
  for (const error of result.errors) {
    console.error(`FAIL: ${error}`);
  }
  process.exit(1);
}
console.log('auto-rollout guard passed');
