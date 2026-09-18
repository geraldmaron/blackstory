/**
 * `/sources` wiring: the public source library is its own room, not a buried Methodology hash.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { destinationFor } from '../../lib/nav/destination-registry';
import { surfaceClassFor } from '../../lib/nav/surface-classes';
import { METHODOLOGY_SOURCE_LIBRARY_HREF } from '../methodology/methodology-copy';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const sectionsSource = readFileSync(join(here, 'SourcesSections.tsx'), 'utf8');

test('/sources is a registered reading room in the trust group', () => {
  assert.equal(surfaceClassFor('/sources'), 'reading');
  const destination = destinationFor('/sources');
  assert.ok(destination, '/sources has no registry entry, so it is in no reader-facing list');
  assert.equal(destination.parent, '/rooms');
  assert.equal(destination.group, 'check');
  assert.equal(destination.label, 'Source library');
  assert.equal(destination.browsable, true);
});

test('the public source-library href is the room, not a methodology fragment', () => {
  assert.equal(METHODOLOGY_SOURCE_LIBRARY_HREF, '/sources');
});

test('the page renders lineage, publisher kinds, and existing surfaces', () => {
  assert.match(pageSource, /SourcesSections/);
  assert.match(sectionsSource, /SOURCE_LINEAGE_STAGES/);
  assert.match(sectionsSource, /SOURCE_PUBLISHER_KINDS/);
  assert.match(sectionsSource, /SOURCE_LIBRARY_SURFACES/);
  assert.match(sectionsSource, /SourceLineageDiagram/);
  assert.match(sectionsSource, /WalkOffRamp/);
  assert.match(sectionsSource, /RoomJump/);
  assert.match(sectionsSource, /RoomHandoff/);
  assert.doesNotMatch(sectionsSource, /—/);
});
