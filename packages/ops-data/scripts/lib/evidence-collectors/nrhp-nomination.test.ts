import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeExtractedText,
  splitNominationSections,
  dropRepeatedPropertyHeader,
  parseNomination,
  checkNominationIdentity,
  nominationTextUrl,
} from './nrhp-nomination.ts';

test('normalizeExtractedText collapses runs of spaces and tabs to single space', () => {
  assert.equal(normalizeExtractedText('hello    world'), 'hello world');
  assert.equal(normalizeExtractedText('hello\t\tworld'), 'hello world');
  assert.equal(normalizeExtractedText('hello  \t  world'), 'hello world');
});

test('normalizeExtractedText collapses 3+ newlines to exactly 2', () => {
  assert.equal(normalizeExtractedText('line1\n\n\nline2'), 'line1\n\nline2');
  assert.equal(normalizeExtractedText('line1\n\n\n\n\nline2'), 'line1\n\nline2');
  assert.equal(normalizeExtractedText('line1\n\nline2'), 'line1\n\nline2');
});

test('normalizeExtractedText trims leading and trailing whitespace', () => {
  assert.equal(normalizeExtractedText('  hello world  '), 'hello world');
  assert.equal(normalizeExtractedText('\n\n  hello world  \n'), 'hello world');
});

test('normalizeExtractedText converts carriage returns to newlines', () => {
  assert.equal(normalizeExtractedText('line1\r\nline2'), 'line1\n\nline2');
  assert.equal(normalizeExtractedText('line1\rline2'), 'line1\nline2');
});

test('splitNominationSections handles vintage A headers with varied spacing and underscores', () => {
  const text = normalizeExtractedText(`
    CONTINUATION SHEET Section number 7 Page 1
    Description of building

    Section number _8_ Page _3_
    Statement of significance
  `);
  const sections = splitNominationSections(text);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].section, '7');
  assert.equal(sections[1].section, '8');
  assert.ok(sections[0].text.includes('Description'));
  assert.ok(sections[1].text.includes('Statement'));
});

test('splitNominationSections handles vintage B headers for sections 7 and 8', () => {
  const text = normalizeExtractedText(`
    Continuation Sheet Section 7-Description
    The building was constructed in 1890

    Continuation Sheet Section 8-Statement of Significance
    This is historically important
  `);
  const sections = splitNominationSections(text);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].section, '7');
  assert.equal(sections[1].section, '8');
  assert.ok(sections[0].text.includes('constructed'));
  assert.ok(sections[1].text.includes('historically'));
});

test('splitNominationSections with vintage B only still yields sections (regression for refnum 00000071)', () => {
  // Refnum 00000071 had only vintage B headers and a parser matching only vintage A returned zero sections
  const text = normalizeExtractedText(`
    Continuation Sheet Section 7-Description
    This property consists of a large brick structure

    Continuation Sheet Section 8-Statement of Significance
    Built in the early twentieth century, this property
    gained significance through its architectural contribution
  `);
  const sections = splitNominationSections(text);
  assert.ok(sections.length > 0, 'vintage B headers must yield at least one section');
  assert.equal(sections.length, 2);
});

test('splitNominationSections concatenates multiple pages of the same section in document order', () => {
  const text = normalizeExtractedText(`
    Section number 8 Page 1
    First paragraph of significance

    Section number 8 Page 2
    Second paragraph of significance

    Section number 8 Page 3
    Third paragraph of significance
  `);
  const sections = splitNominationSections(text);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].section, '8');
  // All three pages should be concatenated with double-newline separators
  assert.ok(sections[0].text.includes('First paragraph'));
  assert.ok(sections[0].text.includes('Second paragraph'));
  assert.ok(sections[0].text.includes('Third paragraph'));
  const firstIdx = sections[0].text.indexOf('First');
  const secondIdx = sections[0].text.indexOf('Second');
  const thirdIdx = sections[0].text.indexOf('Third');
  assert.ok(firstIdx < secondIdx && secondIdx < thirdIdx, 'paragraphs should remain in document order');
});

test('splitNominationSections ignores bare digits in running prose', () => {
  const text = normalizeExtractedText(`
    The building had 8 rooms and 7 windows.
    Section number 7 Page 1
    Description here
  `);
  const sections = splitNominationSections(text);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].section, '7');
  assert.ok(!sections[0].text.includes('rooms'), 'prose before header should not be captured');
});

test('splitNominationSections strips boilerplate from section text', () => {
  const text = normalizeExtractedText(`
    Section number 7 Page 1
    NPS Form 10-900-a
    OMB Approval No. 1024-0018
    United States Department of the Interior
    National Park Service
    CONTINUATION SHEET
    Actual description of the property
  `);
  const sections = splitNominationSections(text);
  assert.equal(sections.length, 1);
  assert.ok(sections[0].text.includes('Actual description'));
  assert.ok(!sections[0].text.includes('NPS Form'));
  assert.ok(!sections[0].text.includes('OMB'));
  assert.ok(!sections[0].text.includes('United States Department'));
  assert.ok(!sections[0].text.includes('CONTINUATION SHEET'));
});

test('dropRepeatedPropertyHeader removes the property name from text', () => {
  const text = 'Smith House, Name of Property Smith House, County and State Building description';
  const result = dropRepeatedPropertyHeader(text, 'Smith House');
  assert.ok(!result.includes('Smith House'));
  assert.ok(result.includes('Building'));
});

test('dropRepeatedPropertyHeader removes form labels without a property name', () => {
  const text = 'Building description Name of Property County and State more description';
  const result = dropRepeatedPropertyHeader(text, 'Smith House');
  assert.ok(!result.includes('Name of Property'));
  assert.ok(!result.includes('County and State'));
  assert.ok(result.includes('Building'));
  assert.ok(result.includes('more'));
});

test('dropRepeatedPropertyHeader is a no-op for display names shorter than 4 chars', () => {
  const text = 'ABC Name of Property County and State description';
  const result = dropRepeatedPropertyHeader(text, 'ABC');
  // Should return unchanged (except trimmed)
  assert.equal(result.trim(), text.trim());
});

test('parseNomination sets hasSignificance true only when section 8 is present', () => {
  const textWith8 = 'Section number 7 Page 1\nDescription\n\nSection number 8 Page 1\nSignificance';
  const resultWith8 = parseNomination(textWith8, 'Test Property');
  assert.equal(resultWith8.hasSignificance, true);

  const textWithout8 = 'Section number 7 Page 1\nDescription only';
  const resultWithout8 = parseNomination(textWithout8, 'Test Property');
  assert.equal(resultWithout8.hasSignificance, false);
});

test('parseNomination returns narrative as sections 7 and 8 joined', () => {
  const text = 'Section number 7 Page 1\nFirst section\n\nSection number 8 Page 1\nSecond section';
  const result = parseNomination(text, 'Test Property');
  assert.ok(result.narrative.includes('First section'));
  assert.ok(result.narrative.includes('Second section'));
});

test('parseNomination returns empty narrative and hasSignificance false for text with no sections', () => {
  const text = 'Just some random text without any section headers';
  const result = parseNomination(text, 'Test Property');
  assert.equal(result.narrative, '');
  assert.equal(result.hasSignificance, false);
});

test('nominationTextUrl builds NPGallery URL for 8-digit refnum', () => {
  const url = nominationTextUrl('71000836');
  assert.equal(url, 'https://npgallery.nps.gov/NRHP/GetAsset/NRHP/71000836_text');
});

test('nominationTextUrl throws for refnum that is not exactly 8 digits', () => {
  assert.throws(() => nominationTextUrl('123'), /8 digits/);
  assert.throws(() => nominationTextUrl('123456789'), /8 digits/);
  assert.throws(() => nominationTextUrl('abcdefgh'), /8 digits/);
  assert.throws(() => nominationTextUrl(''), /8 digits/);
});

test('checkNominationIdentity corroborates place when both state and county appear in narrative', () => {
  const narrative = 'This property is located in Georgia, Cobb County and was built in 1890';
  const result = checkNominationIdentity(narrative, {
    displayName: 'Smith House',
    state: 'georgia',
    county: 'cobb county',
  });
  assert.equal(result.stateMatch, true);
  assert.equal(result.countyMatch, true);
  assert.equal(result.placeCorroborated, true);
});

test('checkNominationIdentity does NOT corroborate when state matches but county does not', () => {
  const narrative = 'This property is located in Georgia, DeKalb County';
  const result = checkNominationIdentity(narrative, {
    displayName: 'Smith House',
    state: 'georgia',
    county: 'cobb county',
  });
  assert.equal(result.stateMatch, true);
  assert.equal(result.countyMatch, false);
  assert.equal(result.placeCorroborated, false);
});

test('checkNominationIdentity corroborates when only state is supplied and matches', () => {
  const narrative = 'This property is located in Georgia';
  const result = checkNominationIdentity(narrative, {
    displayName: 'Smith House',
    state: 'georgia',
  });
  assert.equal(result.placeCorroborated, true);
});

test('checkNominationIdentity corroborates when only county is supplied and matches', () => {
  const narrative = 'This property is located in Cobb County';
  const result = checkNominationIdentity(narrative, {
    displayName: 'Smith House',
    county: 'cobb county',
  });
  assert.equal(result.placeCorroborated, true);
});

test('checkNominationIdentity sets nameMismatch true when place corroborates but name tokens do not', () => {
  // This is the real "Castle Rock" / "Dr. A. Porter Davis Residence" case from refnum 00000109
  const narrative =
    'Dr. A. Porter Davis Residence was constructed in Dallas County, Texas and is known locally as the Davis house';
  const result = checkNominationIdentity(narrative, {
    displayName: 'Castle Rock',
    state: 'texas',
    county: 'dallas county',
  });
  assert.equal(result.placeCorroborated, true, 'place should corroborate');
  assert.equal(result.nameMismatch, true, 'name mismatch should be true when place agrees but name does not');
});

test('checkNominationIdentity sets nameMismatch false when place does not corroborate', () => {
  const narrative = 'Built in a different location';
  const result = checkNominationIdentity(narrative, {
    displayName: 'Smith House',
    state: 'georgia',
    county: 'cobb county',
  });
  assert.equal(result.placeCorroborated, false);
  assert.equal(result.nameMismatch, false, 'nameMismatch is only meaningful when place corroborates');
});

test('checkNominationIdentity ignores filing-inverted punctuation in name matching', () => {
  const narrative =
    'Jude House and George House were located in Fulton County, Georgia and both contributed to the district';
  const result = checkNominationIdentity(narrative, {
    displayName: 'Jude, George, House',
    state: 'georgia',
    county: 'fulton county',
  });
  assert.equal(result.placeCorroborated, true);
  assert.equal(result.nameMatch, true, 'filing-inverted names should match tokens');
});

test('checkNominationIdentity ignores generic tokens in name matching', () => {
  const narrative =
    'The Smith property, which comprises a historic district, was located in Davidson County, Tennessee and was added to the register in 1975';
  const result = checkNominationIdentity(narrative, {
    displayName: 'Smith Historic Building District',
    state: 'tennessee',
    county: 'davidson county',
  });
  assert.equal(result.placeCorroborated, true);
  // 'historic', 'building', 'district' are filtered out, 'smith' should match since it appears in narrative
  assert.ok(result.nameMatch, 'generic tokens should not prevent name match on actual name tokens');
});
