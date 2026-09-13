#!/usr/bin/env node
/**
 * CLI: assert automatic production deploys remain disabled
 * (`docs/decisions-carryover.md`, "Small recovered decisions": ADR-006 GitHub Actions
 * deployment model / ADR-027 Vercel for public web hosting — both ADR files were removed
 * in the 2026-07-24 purge and recovered from the code that implements them).
 *
 * READ THE SCOPE, it is narrower than the name: this guard checks that no GitHub Actions
 * WORKFLOW auto-triggers a deploy. Vercel's own git integration deploys `main` to
 * Production automatically on merge and always sat outside this guard.
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
