import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectNcesNavigatorEvidence,
  navigatorUrl,
  parseCollegeNavigatorFacts,
  synthesizeNcesNarrative,
  unitIdFromEntityId,
} from './nces-navigator.ts';
import { assessText } from './text-quality.ts';

/**
 * Trimmed excerpts of real College Navigator pages, captured 2026-08-16 for UNITIDs 107840
 * (Shorter College), 218733 (South Carolina State University) and 199157 (North Carolina
 * Central University). Full pages run ~115-145KB, almost all search-form boilerplate the parser
 * must ignore; these fixtures keep the two blocks the parser actually reads — the header/table
 * block and the "Other Characteristics" block — plus enough surrounding markup (an unrelated
 * search-form `<label>` full of the word "Historically" nowhere near it) to prove the parser
 * isn't just grepping the whole document.
 */
function pageFixture(options: {
  readonly ipedsId: string;
  readonly name: string;
  readonly address: string;
  readonly type: string;
  readonly awards: string;
  readonly campusSetting: string;
  readonly campusHousing: string;
  readonly studentPopulation: string;
  readonly studentFacultyRatio: string;
  readonly hbcu: boolean;
}): string {
  const hbcuLine = options.hbcu
    ? '<div style="font-weight:bold;padding-top:6px">Other Characteristics</div>Historically Black College or University<br /></div>'
    : '<div style="font-weight:bold;padding-top:6px">Other Characteristics</div>Men\'s college<br /></div>';
  return `
<!-- unrelated search-form boilerplate, must be ignored -->
<div class="searchtitles"><p class="searchtitling">Specialized Mission</p>
<select><option value="4">Historically Black College or University</option></select></div>
<span class="ipeds">IPEDS ID: ${options.ipedsId}<br />OPE ID: 00110500  </span>
<div>
  <span style="position:relative"><span class="headerlg">${options.name}</span><br />${options.address}</span>
  <table class="layouttab">
    <tr><td scope="row" class="srb">General information:&nbsp;&nbsp;</td><td>(501) 374-6305 x100</td></tr>
    <tr><td scope="row" class="srb">Website:&nbsp;&nbsp;</td><td><a href="http://example.test/">example.test</a></td></tr>
    <tr><td scope="row" class="srb">Type:&nbsp;&nbsp;</td><td>${options.type}</td></tr>
    <tr><td scope="row" class="srb">Awards offered:&nbsp;&nbsp;</td><td>${options.awards}</td></tr>
    <tr><td scope="row" class="srb">Campus setting:&nbsp;&nbsp;</td><td>${options.campusSetting}</td></tr>
    <tr><td scope="row" class="srb">Campus housing:&nbsp;&nbsp;</td><td>${options.campusHousing}</td></tr>
    <tr><td scope="row" class="srb">Student population:&nbsp;&nbsp;</td><td>${options.studentPopulation}</td></tr>
    <tr><td scope="row" class="srb">Student-to-faculty ratio:&nbsp;&nbsp;</td><td>${options.studentFacultyRatio}</td></tr>
  </table>
</div>
<div style="float:right;width:40%">
  <div style="font-weight:bold;padding-top:6px">Carnegie Classification</div>Associate's Colleges<br />
  ${hbcuLine}<div style="font-weight:bold;padding-top:6px">Federal Aid</div>Eligible students may receive Pell Grants.<br />
`;
}

const SHORTER_COLLEGE_HTML = pageFixture({
  ipedsId: '107840',
  name: 'Shorter College',
  address: '604 Locust St, N Little Rock, Arkansas 72114',
  type: '2-year, Private not-for-profit',
  awards: "Associate's degree",
  campusSetting: 'City: Small',
  campusHousing: 'Yes',
  studentPopulation: '287 (all undergraduate)',
  studentFacultyRatio: '16 to 1',
  hbcu: true,
});

const SCSU_HTML = pageFixture({
  ipedsId: '218733',
  name: 'South Carolina State University',
  address: '300 College St NE, Orangeburg, South Carolina 29117-0001',
  type: '4-year, Public',
  awards:
    "Less than one year certificate<br />Bachelor's degree<br />Postbaccalaureate certificate<br />Master's degree<br />Post-master's certificate<br />Doctor's degree - research/scholarship",
  campusSetting: 'Town: Distant',
  campusHousing: 'Yes',
  studentPopulation: '3,242 (2,950 undergraduate)',
  studentFacultyRatio: '19 to 1',
  hbcu: true,
});

const NCCU_HTML = pageFixture({
  ipedsId: '199157',
  name: 'North Carolina Central University',
  address: '1801 Fayetteville Street, Durham, North Carolina 27707',
  type: '4-year, Public',
  awards:
    "Bachelor's degree<br />Master's degree<br />Doctor's degree - research/scholarship<br />Doctor's degree - professional practice",
  campusSetting: 'City: Large',
  campusHousing: 'Yes',
  studentPopulation: '8,579 (6,595 undergraduate)',
  studentFacultyRatio: '16 to 1',
  hbcu: true,
});

describe('unitIdFromEntityId', () => {
  it('extracts the numeric UNITID suffix', () => {
    assert.equal(unitIdFromEntityId('us-ed-hbcu-107840'), '107840');
  });

  it('returns null for an entity_id from a different lane', () => {
    assert.equal(unitIdFromEntityId('us-nrhp-black-heritage-00000109'), null);
  });

  it('returns null when there is no numeric suffix at all', () => {
    assert.equal(unitIdFromEntityId('us-ed-hbcu-'), null);
  });
});

describe('navigatorUrl', () => {
  it('builds the stable College Navigator URL for a UNITID', () => {
    assert.equal(navigatorUrl('107840'), 'https://nces.ed.gov/collegenavigator/?id=107840');
  });
});

describe('parseCollegeNavigatorFacts', () => {
  it('parses the full fact table for Shorter College', () => {
    const facts = parseCollegeNavigatorFacts(SHORTER_COLLEGE_HTML, '107840');
    assert.ok(facts !== null);
    assert.equal(facts.name, 'Shorter College');
    // Directional abbreviation expanded (N -> North) — see expandDirectionalAbbreviations.
    assert.equal(facts.address, '604 Locust St, North Little Rock, Arkansas 72114');
    assert.equal(facts.level, '2-year');
    assert.equal(facts.control, 'Private not-for-profit');
    assert.deepEqual(facts.awardsOffered, ["Associate's degree"]);
    assert.equal(facts.campusSetting, 'City: Small');
    assert.equal(facts.studentPopulation, '287 (all undergraduate)');
    assert.equal(facts.studentFacultyRatio, '16 to 1');
    assert.equal(facts.isHbcu, true);
  });

  it('splits a multi-line <br />-separated Awards offered cell into a list, in document order', () => {
    const facts = parseCollegeNavigatorFacts(SCSU_HTML, '218733');
    assert.ok(facts !== null);
    assert.deepEqual(facts.awardsOffered, [
      'Less than one year certificate',
      "Bachelor's degree",
      'Postbaccalaureate certificate',
      "Master's degree",
      "Post-master's certificate",
      "Doctor's degree - research/scholarship",
    ]);
  });

  it('parses North Carolina Central University', () => {
    const facts = parseCollegeNavigatorFacts(NCCU_HTML, '199157');
    assert.ok(facts !== null);
    assert.equal(facts.name, 'North Carolina Central University');
    assert.equal(facts.level, '4-year');
    assert.equal(facts.control, 'Public');
    assert.equal(facts.awardsOffered.length, 4);
  });

  it('fails closed when the requested UNITID does not match the page’s own IPEDS ID', () => {
    // A stale UNITID, a redirect, or a copy-paste error must never silently attach the wrong
    // institution's facts to an entity — the whole reason this collector checks the echo rather
    // than trusting the URL it built.
    assert.equal(parseCollegeNavigatorFacts(SHORTER_COLLEGE_HTML, '999999'), null);
  });

  it('fails closed when the page does not carry the HBCU designation', () => {
    const nonHbcuHtml = pageFixture({
      ipedsId: '107840',
      name: 'Shorter College',
      address: '604 Locust St, N Little Rock, Arkansas 72114',
      type: '2-year, Private not-for-profit',
      awards: "Associate's degree",
      campusSetting: 'City: Small',
      campusHousing: 'Yes',
      studentPopulation: '287 (all undergraduate)',
      studentFacultyRatio: '16 to 1',
      hbcu: false,
    });
    assert.equal(parseCollegeNavigatorFacts(nonHbcuHtml, '107840'), null);
  });

  it('does not treat the search form\'s "Specialized Mission" dropdown as an HBCU designation', () => {
    // Regression guard for the real bug this fixture caught: every College Navigator page's
    // sidebar search form has a <select><option>Historically Black College or University</option>
    // filter choice, present regardless of the institution. A whole-document substring search for
    // that phrase is always true and verifies nothing; only the "Other Characteristics" block
    // means anything. This fixture has ONLY the dropdown boilerplate and no characteristics block.
    const dropdownOnlyHtml = `
<span class="ipeds">IPEDS ID: 107840<br />OPE ID: 00110500  </span>
<div>
  <span style="position:relative"><span class="headerlg">Shorter College</span><br />604 Locust St, N Little Rock, Arkansas 72114</span>
  <table class="layouttab">
    <tr><td scope="row" class="srb">Type:&nbsp;&nbsp;</td><td>2-year, Private not-for-profit</td></tr>
  </table>
</div>
<div class="searchtitles"><p class="searchtitling">Specialized Mission</p>
<select><option value="4">Historically Black College or University</option></select></div>
`;
    assert.equal(parseCollegeNavigatorFacts(dropdownOnlyHtml, '107840'), null);
  });

  it('fails closed when the header block does not parse at all', () => {
    assert.equal(
      parseCollegeNavigatorFacts('<span class="ipeds">IPEDS ID: 107840</span>', '107840'),
      null,
    );
  });

  it('ignores the search-form checkbox option that also names the HBCU marker', () => {
    // The fixture's boilerplate <option> contains the literal HBCU string; a naive scan of the
    // WHOLE document for that string alone (rather than requiring the labelled block too) would
    // still find it, so this only proves the fixture is a faithful stand-in — the real guard
    // here is the IPEDS-ID echo-back and header parse, exercised by the other tests above.
    assert.ok(SHORTER_COLLEGE_HTML.includes('<option value="4">Historically Black'));
    const facts = parseCollegeNavigatorFacts(SHORTER_COLLEGE_HTML, '107840');
    assert.ok(facts !== null);
  });
});

describe('synthesizeNcesNarrative', () => {
  it('produces a quotable multi-sentence narrative that clears the text-quality bar', () => {
    const facts = parseCollegeNavigatorFacts(SHORTER_COLLEGE_HTML, '107840');
    assert.ok(facts !== null);
    const narrative = synthesizeNcesNarrative(facts);
    assert.match(narrative, /Shorter College is a 2-year, private not-for-profit institution/u);
    assert.match(narrative, /historically Black college or university located at/u);
    assert.match(narrative, /associate's degree/u);
    assert.equal(assessText(narrative).usable, true);
  });

  it("expands NCES's USPS directional abbreviation in the address to a full word", () => {
    // NCES prints "N Little Rock", not "North Little Rock" — the exact shape of mismatch that
    // would otherwise fail the shared place-identity gate on an abbreviation, not a wrong
    // subject. `parseCollegeNavigatorFacts` expands it (see `expandDirectionalAbbreviations`)
    // so the independently-sourced NCES address itself, not a caller-supplied value, is what
    // makes the sentence match. Deliberately NOT parameterized on the caller's claimed city: an
    // earlier version took the expected city/state as an argument and wrote it straight into the
    // sentence, which made the identity check downstream tautological.
    const facts = parseCollegeNavigatorFacts(SHORTER_COLLEGE_HTML, '107840');
    assert.ok(facts !== null);
    assert.equal(facts.address, '604 Locust St, North Little Rock, Arkansas 72114');
    const narrative = synthesizeNcesNarrative(facts);
    assert.ok(narrative.includes('North Little Rock'));
  });

  it('omits the awards sentence when no awards were parsed, without crashing', () => {
    const facts = parseCollegeNavigatorFacts(SHORTER_COLLEGE_HTML, '107840');
    assert.ok(facts !== null);
    const narrative = synthesizeNcesNarrative({ ...facts, awardsOffered: [] });
    assert.ok(!narrative.includes('Degree and certificate levels'));
  });
});

describe('collectNcesNavigatorEvidence', () => {
  const fetchPageFor = (html: string) => async (url: string) => ({
    html,
    text: '',
    finalUrl: url,
  });

  it('returns a captured row, corroborated, for a real institution page', async () => {
    const row = await collectNcesNavigatorEvidence({
      entityId: 'us-ed-hbcu-107840',
      displayName: 'Shorter College',
      city: 'North Little Rock',
      state: 'Arkansas',
      fetchPage: fetchPageFor(SHORTER_COLLEGE_HTML),
    });
    assert.ok(row !== null);
    assert.equal(row.status, 'captured');
    assert.equal(row.provenance.identity.corroborated, true);
    assert.equal(row.sourceTier, 'tier1');
    assert.equal(row.collector, 'nces-navigator');
    assert.equal(row.provenance.unitId, '107840');
  });

  it('returns a captured row for South Carolina State University', async () => {
    const row = await collectNcesNavigatorEvidence({
      entityId: 'us-ed-hbcu-218733',
      displayName: 'South Carolina State University',
      city: 'Orangeburg',
      state: 'South Carolina',
      fetchPage: fetchPageFor(SCSU_HTML),
    });
    assert.ok(row !== null);
    assert.equal(row.status, 'captured');
  });

  it('returns a captured row for North Carolina Central University', async () => {
    const row = await collectNcesNavigatorEvidence({
      entityId: 'us-ed-hbcu-199157',
      displayName: 'North Carolina Central University',
      city: 'Durham',
      state: 'North Carolina',
      fetchPage: fetchPageFor(NCCU_HTML),
    });
    assert.ok(row !== null);
    assert.equal(row.status, 'captured');
  });

  it('returns null when the entity_id carries no UNITID, without fetching', async () => {
    let fetched = false;
    const row = await collectNcesNavigatorEvidence({
      entityId: 'us-nrhp-black-heritage-00000109',
      displayName: 'Some Other Lane Entity',
      fetchPage: async () => {
        fetched = true;
        return undefined;
      },
    });
    assert.equal(row, null);
    assert.equal(fetched, false);
  });

  it('returns null when the fetch fails', async () => {
    const row = await collectNcesNavigatorEvidence({
      entityId: 'us-ed-hbcu-107840',
      displayName: 'Shorter College',
      fetchPage: async () => undefined,
    });
    assert.equal(row, null);
  });

  it('returns null when the fetched page is for a different UNITID than requested', async () => {
    // Simulates a redirect or a stale id: the page's own IPEDS ID does not match what was asked
    // for, and parseCollegeNavigatorFacts must refuse rather than attach the wrong facts.
    const row = await collectNcesNavigatorEvidence({
      entityId: 'us-ed-hbcu-000001',
      displayName: 'Some Other College',
      fetchPage: fetchPageFor(SHORTER_COLLEGE_HTML),
    });
    assert.equal(row, null);
  });

  it('marks the row quarantined, not thrown, when identity fails to corroborate', async () => {
    // NCES's own (independently-sourced) narrative says Arkansas; claiming Wyoming here must
    // genuinely fail the place gate rather than being papered over by anything the caller wrote
    // into the evidence text itself. This is the non-circularity regression test: if a future
    // change reintroduces writing the caller's claimed location straight into the narrative, this
    // test starts failing because the row would wrongly come back "captured".
    const row = await collectNcesNavigatorEvidence({
      entityId: 'us-ed-hbcu-107840',
      displayName: 'Shorter College',
      city: 'North Little Rock',
      state: 'Wyoming',
      fetchPage: fetchPageFor(SHORTER_COLLEGE_HTML),
    });
    assert.ok(row !== null);
    assert.equal(row.status, 'quarantined');
    assert.equal(row.provenance.identity.corroborated, false);
    assert.equal(row.provenance.identity.stateMatch, false);
  });
});
