/**
 * The web adapter covers every semantic destination icon id. A missing key here
 * is how two platforms end up drawing different pictures for the same room.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESTINATION_ICON_IDS } from '@repo/public-contracts/destinations';
import { destinationGlyphFor } from './destination-icons';

test('every semantic destination icon id has a web glyph', () => {
  for (const id of DESTINATION_ICON_IDS) {
    const glyph = destinationGlyphFor(id);
    assert.equal(typeof glyph.iconName, 'string', `${id} must resolve to a Font Awesome glyph`);
    assert.ok(glyph.iconName.length > 0, `${id} must not resolve empty`);
  }
});
