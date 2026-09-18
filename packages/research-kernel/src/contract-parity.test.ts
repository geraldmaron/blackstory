import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateContract, type ResearchContractName } from './contracts.js';

const fixtures = JSON.parse(
  readFileSync(new URL('../fixtures/contract-validation.json', import.meta.url), 'utf8'),
) as { name: string; contract: ResearchContractName; payload: unknown; valid: boolean }[];

for (const fixture of fixtures) {
  test(`shared wire contract: ${fixture.name}`, () => {
    assert.equal(validateContract(fixture.contract, fixture.payload).ok, fixture.valid);
  });
}
