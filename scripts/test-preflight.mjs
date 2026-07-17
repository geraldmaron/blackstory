/**
 * Preflight guard: refuse test execution when production identifiers are present.
 * Invoked by root test scripts and CI before any suite runs.
 */
import { assertTestsCannotAccessProduction } from '../packages/testing/src/guards/production.ts';
import { assertQuarantineRegistryHealthy } from '../packages/testing/src/quarantine/registry.ts';

assertTestsCannotAccessProduction(process.env);
assertQuarantineRegistryHealthy();
console.log('Test preflight OK: production guard + quarantine registry healthy');
