import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeExtractedText,
  splitNominationSections,
  dropRepeatedPropertyHeader,
  splitByNarrativeHeadings,
  parseNomination,
  checkNominationIdentity,
  isUsableRefnum,
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
  assert.ok(
    firstIdx < secondIdx && secondIdx < thirdIdx,
    'paragraphs should remain in document order',
  );
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

test('parseNomination puts SIGNIFICANCE before description in the narrative', () => {
  // Everything downstream reads a truncated PREFIX of this string — the enrichment harness hands
  // a model the first 4,000 characters. In section order that prefix is the building's fabric and
  // the history is what falls off the end: measured across the captured corpus, 361 of 368
  // nominations exceed the window and the median one loses 18,893 characters. So the order here
  // decides whether a record gets drafted from its history or from its window sash.
  const text =
    'Section number 7 Page 1\nThe cornice is bracketed\n\n' +
    'Section number 8 Page 1\nThe congregation organized in 1867';
  const result = parseNomination(text, 'Test Property');
  assert.ok(
    result.narrative.indexOf('congregation organized') <
      result.narrative.indexOf('cornice is bracketed'),
    'section 8 (significance) must precede section 7 (description) in the joined narrative',
  );
  // Section 7 is still kept — it is where builders, architects and construction dates appear.
  assert.ok(result.narrative.includes('cornice is bracketed'));
  // The reported section list stays in section order; only the prose was reordered.
  assert.deepEqual(
    result.sections.map((section) => section.section),
    ['7', '8'],
  );
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

/**
 * The 9-digit case is not hypothetical. NPS issues modern listings from a 100000000-block, and
 * rejecting those starved 485 entities in the nrhp-black-heritage lane of the richest source in
 * the corpus — the nomination collector had never been attempted on ANY of the 695 rows carrying
 * one. Verified against NPGallery that they serve full nomination PDFs.
 */
test('nominationTextUrl builds NPGallery URL for a modern 9-digit refnum', () => {
  const url = nominationTextUrl('100002883');
  assert.equal(url, 'https://npgallery.nps.gov/NRHP/GetAsset/NRHP/100002883_text');
});

test('nominationTextUrl throws for a refnum that is not 8 or 9 digits', () => {
  assert.throws(() => nominationTextUrl('123'), /8 or 9 digits/);
  assert.throws(() => nominationTextUrl('1234567'), /8 or 9 digits/);
  assert.throws(() => nominationTextUrl('1234567890'), /8 or 9 digits/);
  assert.throws(() => nominationTextUrl('abcdefgh'), /8 or 9 digits/);
  assert.throws(() => nominationTextUrl(''), /8 or 9 digits/);
});

test('isUsableRefnum accepts both series and nothing else', () => {
  assert.equal(isUsableRefnum('71000836'), true);
  assert.equal(isUsableRefnum('100002883'), true);
  assert.equal(isUsableRefnum('7100083'), false);
  assert.equal(isUsableRefnum(undefined), false);
  // The sweep and nominationTextUrl must not disagree about what is usable; sharing this
  // predicate is what stops a row being rejected before a fetch that would have succeeded.
  assert.equal(isUsableRefnum('100002883'), true);
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
  assert.equal(
    result.nameMismatch,
    true,
    'name mismatch should be true when place agrees but name does not',
  );
});

test('checkNominationIdentity sets nameMismatch false when place does not corroborate', () => {
  const narrative = 'Built in a different location';
  const result = checkNominationIdentity(narrative, {
    displayName: 'Smith House',
    state: 'georgia',
    county: 'cobb county',
  });
  assert.equal(result.placeCorroborated, false);
  assert.equal(
    result.nameMismatch,
    false,
    'nameMismatch is only meaningful when place corroborates',
  );
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

// Tests for splitByNarrativeHeadings fallback segmentation

test('splitByNarrativeHeadings segments on 7. DESCRIPTION and 8. STATEMENT OF SIGNIFICANCE headings with realistic prose', () => {
  const prose7 =
    'The Mitchell House is a two-story brick dwelling constructed in 1892, featuring Romanesque Revival architectural elements including round-arched windows with decorative voussoirs and a prominent corner tower with pyramidal roof. The main facade is articulated by rusticated brick with contrasting bands of lighter stone. The structure served as a residence for prominent civic leaders throughout its history and represents a significant example of late nineteenth-century residential architecture in the county. Windows have been partially replaced but the original ornamental details remain intact on the main elevations. The building sits on a large lot with mature landscaping including several specimen trees dating to the original construction period. The stone foundation is laid in random rubble with lime mortar. The roof is covered with slate shingles and copper flashing.';
  const prose8 =
    "This property is historically significant as the residence of Governor Edward Mitchell, who served from 1901 to 1905 and was instrumental in establishing public education reform throughout the state. The building's architectural significance lies in its exemplary representation of Romanesque Revival design, a style popular among the wealthy elite during the 1890s. The construction techniques visible in the masonry represent the skilled craftsmanship of the period. Several important civic meetings took place within this building during the early twentieth century, making it a center of political activity in the region. The property has been well-maintained and retains most of its original character-defining features including the ornamental brickwork, original window casings, and decorative interior elements. Local historical records document significant events that occurred here.";
  const text = normalizeExtractedText(`
    7. DESCRIPTION
    ${prose7}

    8. STATEMENT OF SIGNIFICANCE
    ${prose8}
  `);
  const sections = splitByNarrativeHeadings(text);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].section, '7');
  assert.equal(sections[1].section, '8');
  assert.ok(sections[0].text.includes('Romanesque'), 'section 7 should include description text');
  assert.ok(sections[1].text.includes('Governor'), 'section 8 should include significance text');
});

test('splitByNarrativeHeadings section 8 ends at following 9. MAJOR BIBLIOGRAPHICAL REFERENCES heading', () => {
  const prose7 =
    "The property consists of a large brick building with multiple stories, constructed in the early twentieth century. The facade features classical proportions with regularly spaced fenestration and decorative stone quoins at the corners. The building's structural system employs timber framing with brick infill, typical of the period. Multiple windows retain original wood casements and divided lights. The roof features slate covering with copper gutters and downspouts. The landscape setting includes mature elm and oak trees along the street front, contributing to the property's sense of place within the historic district. The property maintains structural integrity and good condition.";
  const prose8 =
    "This building served as an important commercial and civic center throughout the twentieth century. It was designed by a prominent regional architect and represents his mature style. The building hosted numerous cultural events and political gatherings that influenced the community's development. Its architectural significance lies in the refined classical details and high-quality materials used throughout. The interior spaces retain period fixtures including original lighting, hardware, and finishes. The building has been sympathetically maintained and continues to serve the community.";
  const bibliography =
    'Smith, John. Historic Architecture of the Region. 1995. County Records, 1901-1950.';

  const text = normalizeExtractedText(`
    7. DESCRIPTION
    ${prose7}

    8. STATEMENT OF SIGNIFICANCE
    ${prose8}

    9. MAJOR BIBLIOGRAPHICAL REFERENCES
    ${bibliography}
  `);
  const sections = splitByNarrativeHeadings(text);
  const section8 = sections.find((s) => s.section === '8');
  assert.ok(section8, 'section 8 should exist');
  assert.ok(section8!.text.includes('cultural events'), 'section 8 should include its prose');
  assert.ok(
    !section8!.text.includes('County Records'),
    'section 8 should NOT include section 9 bibliography text',
  );
});

test('splitByNarrativeHeadings section 8 runs to end of document when there is no section 9 heading', () => {
  const prose8 =
    'This property gained significance through its role in the community development. It was constructed using techniques reflecting the building traditions of the era. The original builders were local craftspeople known for quality work. The building witnessed important historical events that shaped the region. Its architectural features demonstrate high standards of design and execution. The property remains in good condition and continues to serve the community.';

  const text = normalizeExtractedText(`
    8. STATEMENT OF SIGNIFICANCE
    ${prose8}
    Additional details about the building continue here with information about its construction quality and historical importance to the region.
  `);
  const sections = splitByNarrativeHeadings(text);
  const section8 = sections.find((s) => s.section === '8');
  assert.ok(section8, 'section 8 should exist');
  assert.ok(
    section8!.text.includes('significance'),
    'section 8 text should include content up to end of document',
  );
  assert.ok(
    section8!.text.includes('continue here'),
    'section 8 should include trailing text without a section 9 boundary',
  );
});

test('splitByNarrativeHeadings: the LAST occurrence of a heading wins, not the first', () => {
  const shortProse = 'A brief mention.';
  const longProse =
    'The property is significant for multiple reasons. It was designed by a renowned architect and constructed using innovative techniques for its period. The building exemplifies the architectural movement of the era through its proportions, massing, and decorative elements. Throughout its history it served important community functions. The structure maintains excellent integrity with most original features intact including windows, doors, interior details, and decorative treatments. Local historians have documented its significance through primary source research. The building continues to contribute to the character of its historic district.';

  const text = normalizeExtractedText(`
    8. STATEMENT OF SIGNIFICANCE
    ${shortProse}

    Some intervening text here that is not a heading.

    8. STATEMENT OF SIGNIFICANCE
    ${longProse}
  `);
  const sections = splitByNarrativeHeadings(text);
  const section8 = sections.find((s) => s.section === '8');
  assert.ok(section8, 'section 8 should exist');
  assert.ok(!section8!.text.includes('brief mention'), 'should use LAST occurrence, not first');
  assert.ok(
    section8!.text.includes('renowned architect'),
    'should capture the long prose from the later occurrence',
  );
});

test('splitByNarrativeHeadings: a repeated same-numbered heading does not truncate the section', () => {
  const prose2 =
    "The continued description extends from the previous sheet. The property maintains a well-developed landscape setting with specimen trees and period-appropriate fencing. The foundation is laid in stone rubble with lime mortar, showing signs of age but remaining sound. The building's massing and proportions create a pleasing silhouette on the streetscape. Original window glass in the transom lights has survived, providing authentic character. The interior hearths retain original fireplace equipment and chimney details. The property exemplifies construction quality and thoughtful design of the period. Additional interior details include carved woodwork in the main parlor and period-appropriate wall coverings in the dining areas. The staircase features an ornamental newel post and turned balusters indicating high-quality joinery. Multiple fireplaces with original mantels and accessories survive throughout the structure.";

  const text = normalizeExtractedText(`
    8. STATEMENT OF SIGNIFICANCE
    The property was constructed in 1890 and gained significance through its association with important community figures.

    8. STATEMENT OF SIGNIFICANCE
    ${prose2}
  `);
  const sections = splitByNarrativeHeadings(text);
  const section8 = sections.find((s) => s.section === '8');
  assert.ok(section8, 'section 8 should exist');
  // When the same section heading appears multiple times (on continuation sheets), the code uses the LAST occurrence
  // and captures text following it, verifying no error occurs and content is extracted
  assert.ok(
    section8!.text.includes('specimen trees'),
    'should capture text from the last occurrence of heading 8',
  );
});

test('splitByNarrativeHeadings drops a heading opening fewer than 600 characters', () => {
  const tooShortProse = 'This is too short.';
  const longProse =
    "The property represents a significant example of regional architecture from the early twentieth century. It was designed and constructed using high-quality materials and skilled craftsmanship. The building's design demonstrates understanding of contemporary architectural principles and proportional systems. Throughout its operational history the property served important civic and social functions. The structural systems have proven durable and require minimal intervention. Original features including windows, doors, mantels, and hardware demonstrate the quality of the initial construction. The property contributes substantially to the character and continuity of the historic district.";

  const text = normalizeExtractedText(`
    7. DESCRIPTION
    ${tooShortProse}

    8. STATEMENT OF SIGNIFICANCE
    ${longProse}
  `);
  const sections = splitByNarrativeHeadings(text);
  const section7 = sections.find((s) => s.section === '7');
  const section8 = sections.find((s) => s.section === '8');
  assert.equal(section7, undefined, 'section 7 should be dropped because it has insufficient text');
  assert.ok(section8, 'section 8 should exist because it has sufficient text');
});

test('splitByNarrativeHeadings recognizes NARRATIVE DESCRIPTION and NARRATIVE STATEMENT OF SIGNIFICANCE variants', () => {
  const prose7 =
    'The building was constructed with timber frame and brick infill, employing techniques standard for the period. The exterior exhibits fine brickwork with soldier course banding and decorative corbelling beneath the eaves. Window openings retain much original glazing with period-appropriate muntin patterns. The roof structure uses timber principals and purlins, covered with slate shingles showing excellent preservation. The main entrance features an ornamental pediment with carved detailing. Interior spaces preserve original plaster finishes, hardwood flooring, and decorative moldings. The property demonstrates high standards of building practice and materials selection throughout.';
  const prose8 =
    'The property gained its historical significance through association with prominent community leaders and important local institutions. The architecture reflects influences from contemporary design movements adapted to local conditions and materials. Stylistic features including proportions, fenestration patterns, and ornamental details exemplify the architectural language of the period. The property has been maintained in good condition and retains integrity in design, materials, and workmanship. Historic photographs and records document the property through various periods. The building continues to serve useful purposes while maintaining its historical character.';

  const text = normalizeExtractedText(`
    NARRATIVE DESCRIPTION
    ${prose7}

    NARRATIVE STATEMENT OF SIGNIFICANCE
    ${prose8}
  `);
  const sections = splitByNarrativeHeadings(text);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].section, '7');
  assert.equal(sections[1].section, '8');
  assert.ok(sections[0].text.includes('timber'), 'NARRATIVE DESCRIPTION variant should work');
  assert.ok(
    sections[1].text.includes('significance'),
    'NARRATIVE STATEMENT OF SIGNIFICANCE variant should work',
  );
});

test('splitByNarrativeHeadings returns empty array for text with no narrative headings', () => {
  const text = normalizeExtractedText(`
    This is just some random text without any of the narrative section headings.
    It talks about various things but never mentions section 7 or section 8 or any of the expected narrative structures.
    There are no DESCRIPTION or STATEMENT OF SIGNIFICANCE headings present in this text.
  `);
  const sections = splitByNarrativeHeadings(text);
  assert.equal(
    sections.length,
    0,
    'should return empty array when no narrative headings are found',
  );
});

// Tests for parseNomination fallback wiring

test('parseNomination: when text HAS a readable section table, segmentation is section-table', () => {
  const text = normalizeExtractedText(`
    Section number 7 Page 1
    Description of the property's physical features and construction details

    Section number 8 Page 2
    Statement of the property's historical significance and importance
  `);
  const result = parseNomination(text, 'Test Property');
  assert.equal(
    result.segmentation,
    'section-table',
    'should use section-table when headers are readable',
  );
  assert.ok(result.narrative.length > 0, 'should have captured narrative');
});

test('parseNomination: refnum 00000534 case with corrupted section table falls back to narrative headings', () => {
  // This reproduces the real case: "Section number Z — Page — I —" where the section number is corrupted
  const prose8 =
    "The property is historically significant as the former residence of State Senator James Whitmore, who served from 1903 to 1921 and was influential in the development of state transportation infrastructure. The building exemplifies Victorian architectural style with Queen Anne elements including asymmetrical facade, varied wall textures, and decorative bargeboards. Constructed in 1887, the building originally included extensive grounds with carriage house and servants quarters, now removed. The main residence retains original interior features including parquet flooring, ornamental plaster work, and period light fixtures. Historic photographs document the property's original appearance and landscaping. The property has been recognized by the state historical society as significant to the community's development.";

  const text = normalizeExtractedText(`
    CONTINUATION SHEET
    Section number Z — Page — I —

    Some intervening text

    8. STATEMENT OF SIGNIFICANCE
    ${prose8}
  `);
  const result = parseNomination(text, 'Whitmore House');
  assert.equal(
    result.segmentation,
    'narrative-headings',
    'should fall back to narrative-headings when section table is unreadable',
  );
  assert.ok(result.narrative.length > 0, 'should have captured narrative via fallback');
  assert.ok(result.narrative.includes('Senator'), 'narrative should contain the significance text');
  assert.equal(result.hasSignificance, true, 'should identify section 8 from narrative fallback');
});

test('parseNomination: when neither section table nor narrative headings present, segmentation is none', () => {
  const text = normalizeExtractedText(`
    This is a form with no readable section headers and no narrative headings.
    It contains some text but nothing that matches the expected patterns for either segmentation strategy.
  `);
  const result = parseNomination(text, 'Unknown Property');
  assert.equal(result.segmentation, 'none', 'should report segmentation as none');
  assert.equal(result.narrative, '', 'should have empty narrative');
  assert.equal(result.hasSignificance, false, 'should report no significance found');
});

test('parseNomination: section table takes priority even when narrative headings are also present', () => {
  const tableDescribedProse =
    'The property was built in 1895 using local brick and stone materials in a commercial Romanesque style with heavy rustication and round arches.';
  const narrativeHeadingProse =
    'The property gained importance through its long service as a community meeting hall and cultural center. It represents skilled craftsmanship and enduring architectural principles. The original building materials and construction techniques demonstrate the quality standards of the period.';

  const text = normalizeExtractedText(`
    Section number 7 Page 1
    ${tableDescribedProse}

    Section number 8 Page 2
    ${narrativeHeadingProse}

    Additional text with narrative headings mixed in:

    8. STATEMENT OF SIGNIFICANCE
    This would be an alternate segmentation, but the section table should take priority.
  `);
  const result = parseNomination(text, 'Test Building');
  assert.equal(
    result.segmentation,
    'section-table',
    'should prefer section-table over narrative-headings',
  );
  assert.ok(
    result.narrative.includes('Romanesque'),
    'should use text from section-table headers, not narrative headings',
  );
});

// Both nomination quarantines in the first 100-entity batch were real documents about the right
// property, refused over a place-name technicality. These pin the two fixes.

test('a city match satisfies place corroboration when the county is never named', () => {
  // Urban nominations name the city and never the county. The Herndon Home nomination names
  // Atlanta 118 times and Fulton County only on the front form.
  const doc =
    'The Herndon Home stands in Atlanta, Georgia, built for Alonzo Herndon, founder of the ' +
    'Atlanta Life Insurance Company. The house remained in the family until 1927.';
  const result = checkNominationIdentity(doc, {
    displayName: 'Herndon Home',
    state: 'Georgia',
    county: 'Fulton',
    city: 'Atlanta',
  });
  assert.equal(result.countyMatch, false, 'the county genuinely is not in this text');
  assert.equal(result.cityMatch, true);
  assert.equal(result.placeCorroborated, true, 'city corroboration must be enough');
});

test('county spelling differences that are only spacing do not fail corroboration', () => {
  // The roster files this county as "De Kalb"; the form prints "DeKalb".
  const doc = 'Stone Mountain Historic District is located in DeKalb County, Georgia.';
  const result = checkNominationIdentity(doc, {
    displayName: 'Stone Mountain Historic District',
    state: 'Georgia',
    county: 'De Kalb',
  });
  assert.equal(result.countyMatch, true, '"De Kalb" must match "DeKalb"');
  assert.equal(result.placeCorroborated, true);
});

test('a genuinely different place still fails corroboration', () => {
  // The relaxations above must not turn the gate off: this is the case it exists to catch.
  const doc = 'The Smith Farmstead is located in Marion County, Iowa, established in 1868.';
  const result = checkNominationIdentity(doc, {
    displayName: 'Herndon Home',
    state: 'Georgia',
    county: 'Fulton',
    city: 'Atlanta',
  });
  assert.equal(result.placeCorroborated, false);
});
