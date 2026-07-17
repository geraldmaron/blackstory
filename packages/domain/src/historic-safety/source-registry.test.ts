/**
 * Tests for -owned source registrations (EJI, Tougaloo) and read-only launch-corpus pointers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInMemorySourceRegistry } from '../adapters/registry.js';
import { corpusSourceRegistryEntryId } from '../corpus-vetting.js';
import {
  buildHistoricSafetySourceRegistrationInputs,
  createInMemoryHistoricSafetySourceRegistryStore,
  HISTORIC_SAFETY_SOURCE_IDS,
  REFERENCED_LAUNCH_CORPUS_SLUGS,
  referencedLaunchCorpusRegistryEntryId,
  registerHistoricSafetySources,
} from './source-registry.js';
import type { RightsPolicy } from '../provenance/rights.js';

const NOW = '2026-07-17T12:00:00.000Z';

const ATTRIBUTION_REQUIRED_RIGHTS: RightsPolicy = {
  defaultStatus: 'attribution_required',
  publicationPermissions: ['cite_and_link'],
  prohibitedUses: ['bulk_reproduction'],
};

test('HISTORIC_SAFETY_SOURCE_IDS covers EJI lynching records and Tougaloo sundown towns', () => {
  assert.deepEqual(HISTORIC_SAFETY_SOURCE_IDS, ['eji-lynching-records', 'tougaloo-sundown-towns']);
});

test('buildHistoricSafetySourceRegistrationInputs records mandatory EJI and Tougaloo citation requirements', () => {
  const inputs = buildHistoricSafetySourceRegistrationInputs({
    registeredBy: 'operator-gerald',
    registeredAt: NOW,
    rights: ATTRIBUTION_REQUIRED_RIGHTS,
  });
  assert.equal(inputs.length, 2);

  const eji = inputs.find((input) => input.sourceId === 'eji-lynching-records');
  assert.ok(eji);
  assert.match(eji!.citationRequirements, /Equal Justice Initiative/i);
  assert.match(eji!.citationRequirements, /eji\.org/i);
  assert.equal(eji!.feedsLayerId, 'documented_events');

  const tougaloo = inputs.find((input) => input.sourceId === 'tougaloo-sundown-towns');
  assert.ok(tougaloo);
  assert.match(tougaloo!.citationRequirements, /Tougaloo College Historical Database of Sundown Towns/i);
  assert.match(tougaloo!.citationRequirements, /possible\/probable\/surely/i);
  assert.equal(tougaloo!.feedsLayerId, 'sundown_town');
});

test('registerHistoricSafetySources registers both sources through the BB-037 registry without re-registering launch corpora', () => {
  const registryStore = createInMemorySourceRegistry();
  const sourceRegistryStore = createInMemoryHistoricSafetySourceRegistryStore();
  const registrations = registerHistoricSafetySources(registryStore, sourceRegistryStore, {
    registeredBy: 'operator-gerald',
    registeredAt: NOW,
    rights: ATTRIBUTION_REQUIRED_RIGHTS,
  });

  assert.equal(registrations.length, 2);
  for (const registration of registrations) {
    assert.ok(registration.citationRequirements.trim().length > 0);
    assert.ok(registration.sourceRegistryEntryId.startsWith('historic_safety_source_registry:'));
    assert.equal(sourceRegistryStore.get(registration.sourceId)?.sourceId, registration.sourceId);
  }
});

test('REFERENCED_LAUNCH_CORPUS_SLUGS points at mapping-inequality-holc for exclusion infrastructure (AC12)', () => {
  assert.equal(REFERENCED_LAUNCH_CORPUS_SLUGS.exclusion_infrastructure, 'mapping-inequality-holc');
  assert.equal(
    referencedLaunchCorpusRegistryEntryId('mapping-inequality-holc'),
    corpusSourceRegistryEntryId('mapping-inequality-holc'),
  );
});
