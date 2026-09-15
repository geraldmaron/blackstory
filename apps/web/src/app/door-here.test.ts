import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hereLocality } from './door-here';

test('a place label that starts with the name gives only the locality', () => {
  assert.equal(
    hereLocality('Townsend School', 'Townsend School, Winchester, Tennessee'),
    'Winchester, Tennessee',
  );
  assert.equal(
    hereLocality(
      'Elm Hill Avenue-Georgia Street-Cheney Street Historic District',
      'Elm Hill Avenue-Georgia Street-Cheney Street Historic District, Boston, Massachusetts',
    ),
    'Boston, Massachusetts',
  );
});

test('a label that is only the name adds nothing, whatever its case', () => {
  assert.equal(
    hereLocality('Montgomery Greyhound Bus Station', 'Montgomery Greyhound Bus Station'),
    null,
  );
  assert.equal(hereLocality('Townsend School', ' townsend school, '), null);
});

test('a name that is only the start of a longer title keeps the whole label', () => {
  assert.equal(
    hereLocality(
      'National Baseball Hall of Fame',
      'National Baseball Hall of Fame and Museum, Cooperstown, New York',
    ),
    'National Baseball Hall of Fame and Museum, Cooperstown, New York',
  );
});

test('an unrelated label stays whole, and an empty one gives nothing', () => {
  assert.equal(hereLocality('Dr. Calvin H. Shirley', 'Fort Lauderdale, FL'), 'Fort Lauderdale, FL');
  assert.equal(hereLocality('Somewhere', '   '), null);
});
