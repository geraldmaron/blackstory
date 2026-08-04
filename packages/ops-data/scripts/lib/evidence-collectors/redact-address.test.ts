import assert from 'node:assert/strict';
import test from 'node:test';
import { redactStreetAddresses, REDACTION_MARKER } from './redact-address.ts';

test('numbered street addresses are redacted with standard formats', () => {
  const cases = [
    '511 West South Street',
    '1121 Martin Luther King Jr. Drive',
    '42 Oak Rd.',
    '1600 Pennsylvania Avenue',
    '99 East Main Street',
  ];

  for (const address of cases) {
    const result = redactStreetAddresses(address);
    assert.equal(result.text, REDACTION_MARKER, `Failed to redact: ${address}`);
    assert.equal(result.redactionCount, 1, `Expected 1 redaction for: ${address}`);
  }
});

test('abbreviated street types with periods are caught', () => {
  const cases = [
    'The property at 511 West St. is restricted',
    '1121 MLK Jr. Ave. served as a meeting place',
    'Located at 42 Oak Rd. in the county',
    '1600 Main Blvd. was expanded in 1950',
    'Corner of 55 Oak Dr. and Pine Lane',
    'Route 9 near 120 Mountain Hwy. corridor',
    '200 North Pkwy. in the historic zone',
  ];

  for (const text of cases) {
    const result = redactStreetAddresses(text);
    assert.ok(result.redactionCount >= 1, `Expected at least one redaction in: ${text}`);
    assert.ok(
      result.text.includes(REDACTION_MARKER),
      `Expected redaction marker in result for: ${text}`,
    );
  }
});

test('bare place names without house numbers survive unchanged', () => {
  const cases = [
    'The property faces South Street',
    'Washington Boulevard runs north to the river',
    'Traveling along Main Avenue toward the center',
    'The Oak Lane historic district was established in 1923',
    'North Drive separates the two parcels',
    'West Street ends at the county line',
  ];

  for (const text of cases) {
    const result = redactStreetAddresses(text);
    assert.equal(result.text, text, `Bare place name was incorrectly modified: ${text}`);
    assert.equal(result.redactionCount, 0, `Expected 0 redactions for bare place name: ${text}`);
  }
});

test('rural routes and box numbers are redacted', () => {
  const cases = [
    'R.R. 2, Box 51',
    'Rural Route 3',
    'P.O. Box 118',
    'HCR 4 Box 12',
    'RR 1 Box 5',
    'Rural Route 15, Box 8',
    'HCR 2 Box 22',
  ];

  for (const address of cases) {
    const result = redactStreetAddresses(address);
    assert.equal(result.text, REDACTION_MARKER, `Failed to redact rural address: ${address}`);
    assert.equal(result.redactionCount, 1, `Expected 1 redaction for: ${address}`);
  }
});

test('township-range-section legal descriptions are redacted', () => {
  const cases = [
    'T. 12 N., R. 4 E., Sec. 22',
    'Township 7 S, Range 19 W',
    'T12N R4E Sec 22',
    'T. 8 S., R. 6 W.',
  ];

  for (const description of cases) {
    const result = redactStreetAddresses(description);
    assert.equal(
      result.text,
      REDACTION_MARKER,
      `Failed to redact legal description: ${description}`,
    );
    assert.equal(result.redactionCount, 1, `Expected 1 redaction for: ${description}`);
  }
});

test('UTM and coordinate data are redacted', () => {
  const cases = [
    'UTM Zone 16 Easting 234567 Northing 3456789',
    'Latitude 34.052235',
    'Longitude -117.201117',
    'UTM coordinates 16S 234567 3456789',
  ];

  for (const coords of cases) {
    const result = redactStreetAddresses(coords);
    assert.ok(
      result.text.includes(REDACTION_MARKER),
      `Failed to redact coordinates: ${coords}`,
    );
    assert.equal(result.redactionCount, 1, `Expected 1 redaction for: ${coords}`);
  }
});

test('redactionCount reflects exact number of distinct redactions in text', () => {
  const text1 = '511 West Street and 200 Oak Avenue are both restricted';
  const result1 = redactStreetAddresses(text1);
  assert.equal(result1.redactionCount, 2, 'Expected 2 street address redactions');

  const text2 = 'The site is at R.R. 3, Box 12 and township T. 5 N., R. 8 E.';
  const result2 = redactStreetAddresses(text2);
  assert.equal(result2.redactionCount, 2, 'Expected 2 total redactions (one rural, one legal)');
});

test('multiple addresses in one passage are ALL redacted', () => {
  const text = `The first structure was located at 511 West Street.
    A second site at 1121 Martin Luther King Jr. Drive served similar purposes.
    The third property at 42 Oak Road was added in 1990.`;

  const result = redactStreetAddresses(text);
  // Should have exactly 3 redactions
  assert.equal(result.redactionCount, 3, 'Expected exactly 3 address redactions');
  // Original numbers should not survive anywhere
  assert.ok(!result.text.includes('511'), 'Original address 511 leaked into output');
  assert.ok(!result.text.includes('1121'), 'Original address 1121 leaked into output');
  assert.ok(!result.text.includes('42'), 'Original address 42 (from street) leaked into output');
  // Marker should appear 3 times
  const markerCount = (result.text.match(/\[address restricted\]/g) || []).length;
  assert.equal(markerCount, 3, `Expected 3 markers in output, found ${markerCount}`);
});

test('redaction is idempotent: running twice equals running once', () => {
  const text = 'The property at 511 West Street was documented carefully.';
  const result1 = redactStreetAddresses(text);
  const result2 = redactStreetAddresses(result1.text);

  assert.equal(result1.text, result2.text, 'Second redaction changed the text');
  assert.equal(result1.redactionCount, 1, 'Expected 1 redaction on first pass');
  assert.equal(result2.redactionCount, 0, 'Expected 0 additional redactions on second pass');
});

test('empty string returns empty string with redactionCount of 0', () => {
  const result = redactStreetAddresses('');
  assert.equal(result.text, '');
  assert.equal(result.redactionCount, 0);
});

test('realistic NRHP nomination prose preserves historical narrative while redacting address', () => {
  // Real-world NRHP nomination excerpt with address embedded
  const text = `The Johnson-Smith Funeral Home, built in 1887 at 511 West South Street,
    represents a fine example of late Victorian commercial architecture in the downtown
    historic district. The three-story brick structure features ornamental stone lintels,
    a pressed metal cornice, and tall arched windows characteristic of the era. This
    establishment served the African-American community for over a century, providing
    essential services during the Jim Crow period when segregated facilities operated
    throughout the city. The funeral home was operated continuously by the Johnson and
    Smith families, maintaining its original interior woodwork, original hardwood floors,
    and period fixtures including the cast-iron heating stove. The property retains
    excellent integrity and is significant for its architectural quality and its role in
    community history.`;

  const result = redactStreetAddresses(text);

  // Address should be redacted
  assert.ok(!result.text.includes('511 West South Street'), 'Address was not redacted');
  assert.equal(result.redactionCount, 1, 'Expected exactly 1 redaction');

  // Historical narrative should survive
  assert.ok(result.text.includes('Johnson-Smith Funeral Home'), 'Property name lost');
  assert.ok(result.text.includes('1887'), 'Construction date lost');
  assert.ok(
    result.text.includes('late Victorian commercial architecture'),
    'Architectural description lost',
  );
  assert.ok(result.text.includes('African-American community'), 'Community context lost');
  assert.ok(result.text.includes('Jim Crow'), 'Historical context lost');
  assert.ok(result.text.includes('architectural quality'), 'Significance lost');

  // Marker should be present
  assert.ok(result.text.includes(REDACTION_MARKER), 'Redaction marker not found');
});

test('property described with compass direction and street type survives without house number', () => {
  const text = `The nomination states that the East side of South Street contains
    several contributing structures, and the western boundary follows North Avenue
    for approximately 200 feet. The property adjoins the Main Street historic district
    to the south.`;

  const result = redactStreetAddresses(text);
  assert.equal(result.redactionCount, 0, 'Bare street names without numbers should not be redacted');
  assert.equal(result.text, text, 'Text should be unchanged');
});

test('mixed content with addresses, coordinates, and bare street names handles each correctly', () => {
  const text = `The site occupies a parcel along West Main Street in the historic district.
    The nominated property at 211 Oak Avenue was surveyed at latitude 35.245801 and
    longitude -81.635411. The township designation is T. 4 S., R. 5 W., Sec. 18.
    The structure faces north toward North Street.`;

  const result = redactStreetAddresses(text);

  // Should have 4 redactions: 211 Oak Avenue, coordinates (latitude/longitude), legal description
  assert.equal(result.redactionCount, 4, `Expected 4 redactions, got ${result.redactionCount}`);

  // Bare street names should survive
  assert.ok(result.text.includes('West Main Street'), 'Bare "West Main Street" was redacted');
  assert.ok(result.text.includes('North Street'), 'Bare "North Street" was redacted');

  // Address with number should be gone
  assert.ok(!result.text.includes('211 Oak Avenue'), 'Numbered address not redacted');
});

test('house number followed by compass abbreviation and street name is redacted', () => {
  const cases = [
    '123 N. Main Street',
    '456 S. Oak Ave',
    '789 E. Pine Rd',
    '321 W. Elm Dr.',
  ];

  for (const address of cases) {
    const result = redactStreetAddresses(address);
    assert.equal(result.text, REDACTION_MARKER, `Failed to redact compass address: ${address}`);
  }
});

test('long street name with multiple words and house number is redacted', () => {
  const text = '2345 North Central Avenue';
  const result = redactStreetAddresses(text);
  assert.equal(result.text, REDACTION_MARKER, 'Multi-word street name not redacted');
  assert.equal(result.redactionCount, 1);
});

test('single and double-digit house numbers are both redacted', () => {
  const singleDigit = '5 Main Street';
  const doubleDigit = '55 Main Street';
  const tripleDigit = '555 Main Street';

  const result1 = redactStreetAddresses(singleDigit);
  const result2 = redactStreetAddresses(doubleDigit);
  const result3 = redactStreetAddresses(tripleDigit);

  assert.equal(result1.text, REDACTION_MARKER, 'Single digit address not redacted');
  assert.equal(result2.text, REDACTION_MARKER, 'Double digit address not redacted');
  assert.equal(result3.text, REDACTION_MARKER, 'Triple digit address not redacted');
});

// The three leaks below were found by adversarially probing the module against the shapes real
// restricted nominations actually use, after the first round of tests reported no leaks. Each
// one located a property as precisely as a street address would.

test('directional locators are redacted — the form used for rural churches and burial grounds', () => {
  // Restricted properties usually have NO street address; the nomination locates them by
  // bearing from a landmark instead. Redacting street addresses while leaving these would
  // protect exactly the properties that need it least.
  const text = 'The cemetery is on the old Johnson farm, 3 miles east of Whitesboro.';
  const result = redactStreetAddresses(text);
  assert.ok(result.text.includes(REDACTION_MARKER), 'directional locator must be redacted');
  assert.ok(!result.text.includes('Whitesboro'), 'the landmark it bears from must not survive');
  assert.equal(result.redactionCount, 1);
});

test('fractional-mile directional locators are redacted', () => {
  const text = 'The site lies approximately 1.5 miles north of the junction.';
  const result = redactStreetAddresses(text);
  assert.ok(result.text.includes(REDACTION_MARKER));
  assert.ok(!result.text.includes('1.5 miles north'));
});

test('lot-and-block plat descriptions are redacted', () => {
  // A lot-and-block reference locates a parcel as precisely as a street address does in any
  // county recorder's office, and it is the standard form on urban nominations.
  const text = 'The dwelling occupies Lot 14, Block 3 of the Smithfield Addition.';
  const result = redactStreetAddresses(text);
  assert.ok(result.text.includes(REDACTION_MARKER), 'lot/block must be redacted');
  assert.ok(!result.text.includes('Lot 14'));
  assert.ok(!result.text.includes('Smithfield Addition'));
});

test('bare decimal coordinate pairs are redacted even with no label in front of them', () => {
  // COORDINATE_RE only fires on a labelled coordinate ("Latitude 34.05"), so an unlabelled
  // pair leaked straight through.
  const text = 'Coordinates: 34.052235, -118.243683';
  const result = redactStreetAddresses(text);
  assert.ok(result.text.includes(REDACTION_MARKER));
  assert.ok(!result.text.includes('34.052235'));
  assert.ok(!result.text.includes('118.243683'));
});

test('a bare compass direction with no distance is left alone', () => {
  // "north of the river" is orientation, not a locator, and losing it costs description
  // without protecting anything.
  const text = 'The church sits north of the river in a wooded lot.';
  const result = redactStreetAddresses(text);
  assert.equal(result.text, text);
  assert.equal(result.redactionCount, 0);
});
