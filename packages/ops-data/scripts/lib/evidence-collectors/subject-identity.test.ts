import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkPlaceIdentity,
  checkSubjectIdentity,
  containsWholeWord,
  countWholeWord,
  foldPunctuation,
  isIndexDocument,
  nameTokensCooccur,
  significantNameTokens,
} from './subject-identity.ts';

/**
 * The negative cases below are the real mismatches measured in the 2026-08-10 enrichment round
 * (repo-ppeu): 9 of 24 subjects were handed evidence about a different subject. Each is written
 * from what the captured document actually was, because the point of the gate is these documents
 * and a synthetic "obviously wrong" fixture would not have exercised the old code either.
 */
describe('checkSubjectIdentity rejects the measured repo-ppeu mismatches', () => {
  it('rejects the wrong state: Covington, KENTUCKY for a Covington, VIRGINIA church', () => {
    const identity = checkSubjectIdentity(
      'Covington is a home rule-class city in Kenton County, Kentucky, United States. Located at ' +
        'the confluence of the Ohio and Licking rivers, it is the largest city in Northern Kentucky.',
      {
        displayName: 'First Baptist Church',
        city: 'Covington',
        county: 'Alleghany',
        state: 'Virginia',
      },
      { title: 'Covington, Kentucky' },
    );
    assert.equal(identity.corroborated, false);
    assert.equal(identity.stateMatch, false);
    assert.match(identity.reason ?? '', /place/u);
  });

  it('rejects a state-only match: a Virginia election article for a Virginia house', () => {
    const identity = checkSubjectIdentity(
      'The 2021 Virginia gubernatorial election was held on November 2, 2021, to elect the ' +
        'governor of Virginia. Republican nominee Glenn Youngkin defeated Democratic nominee ' +
        'Terry McAuliffe. Virginia voters also elected a lieutenant governor.',
      {
        displayName: 'Johnson, Dr. Robert Walker, House',
        city: 'Lynchburg',
        county: 'Lynchburg',
        state: 'Virginia',
      },
      { title: '2021 Virginia gubernatorial election' },
    );
    assert.equal(identity.corroborated, false);
    // Place agrees on the state; it is the NAME gate that has to stop this one.
    assert.equal(identity.nameCorroborated, false);
  });

  it('rejects an index page that names the subject in a table row', () => {
    const identity = checkSubjectIdentity(
      'This is a list of the National Register of Historic Places listings in Lexington, ' +
        'Virginia. Barclay House. Blandome. Castle Hill. Col Alto. Jackson House.',
      { displayName: 'Blandome', city: 'Lexington', county: 'Lexington', state: 'Virginia' },
      { title: 'National Register of Historic Places listings in Lexington, Virginia' },
    );
    assert.equal(identity.corroborated, false);
    assert.equal(identity.documentKind, 'index');
  });

  it('rejects a dictionary definition standing in for a building', () => {
    const identity = checkSubjectIdentity(
      'A teacherage is a residence provided for a teacher or teachers, typically adjacent to a ' +
        'rural school. Teacherages were common in the United States in the early 20th century.',
      {
        displayName: 'Rosenwald School Teacherage',
        city: 'Warrenton',
        county: 'Warren',
        state: 'North Carolina',
      },
      { title: 'Teacherage' },
    );
    assert.equal(identity.corroborated, false);
    assert.equal(identity.placeCorroborated, false);
  });

  it('rejects a town article standing in for a clinic in that town', () => {
    const identity = checkSubjectIdentity(
      'Tarboro is a town in and the county seat of Edgecombe County, North Carolina. The ' +
        'population was 11,415 at the 2010 census. Tarboro was founded in 1760 on the Tar River.',
      {
        displayName: 'Quigless Clinic and Hospital',
        city: 'Tarboro',
        county: 'Edgecombe',
        state: 'North Carolina',
      },
      { title: 'Tarboro, North Carolina' },
    );
    assert.equal(identity.corroborated, false);
    assert.equal(identity.nameCorroborated, false);
  });

  it('rejects a document that mentions the subject once but is about something else', () => {
    const identity = checkSubjectIdentity(
      'Downtown Fort Worth is the central business district of Fort Worth, Texas. Sundance Square ' +
        'anchors the district with restaurants and shops. '.padEnd(1_400, 'x') +
        ' The Terrell Heights district lies to the east.',
      {
        displayName: 'Terrell Heights Historic District',
        city: 'Fort Worth',
        county: 'Tarrant',
        state: 'Texas',
      },
      { title: 'Downtown Fort Worth' },
    );
    assert.equal(identity.corroborated, false);
    assert.equal(identity.focusCorroborated, false);
    assert.match(identity.reason ?? '', /not about it/u);
  });

  it('rejects a disambiguation page even when it names the target place', () => {
    const identity = checkSubjectIdentity(
      'Maplewood may refer to:\n\nUnited States\n\nMaplewood, Jefferson County, Alabama\n' +
        'Maplewood, California',
      { displayName: 'Maplewood', county: 'Jefferson', state: 'Alabama' },
      { title: 'Maplewood' },
    );
    assert.equal(identity.corroborated, false);
    assert.equal(identity.documentKind, 'disambiguation');
  });
});

describe('checkSubjectIdentity accepts genuine subject documents', () => {
  it('accepts an article whose first sentence is the subject in the right place', () => {
    const identity = checkSubjectIdentity(
      'The Whitelaw Hotel is a historic building at 1839 13th Street NW in Washington, D.C. ' +
        'Built in 1919 by John Whitelaw Lewis, it was the first luxury hotel in the city built ' +
        'for and by African Americans. The Whitelaw served as a social center of Black Washington.',
      { displayName: 'Whitelaw Hotel', city: 'Washington', state: 'District of Columbia' },
      { title: 'Whitelaw Hotel' },
    );
    assert.equal(identity.corroborated, true);
    assert.equal(identity.reason, undefined);
  });

  it('accepts a filing-inverted roster name whose tokens appear in the prose', () => {
    const identity = checkSubjectIdentity(
      'The George Jude House is a historic home in Selma, Dallas County, Alabama. Jude, a ' +
        'carpenter, built the house in 1902. The Jude family occupied it for three generations.',
      { displayName: 'Jude, George, House', city: 'Selma', county: 'Dallas', state: 'Alabama' },
      { title: 'George Jude House' },
    );
    assert.equal(identity.corroborated, true);
  });

  it('accepts a subject named late in a page with navigation chrome, via repeated mention', () => {
    const identity = checkSubjectIdentity(
      'Home About Contact Collections Exhibits Visit Support Search '.repeat(30) +
        'The Quigless Clinic opened in 1946. Dr. Helen Quigless practiced there for four decades, ' +
        'and the Quigless family maintained the building until 1997.',
      {
        displayName: 'Quigless Clinic and Hospital',
        city: 'Tarboro',
        county: 'Edgecombe',
        state: 'North Carolina',
      },
      { title: 'Quigless Clinic' },
    );
    assert.equal(identity.focusCorroborated, true);
  });
});

describe('checkSubjectIdentity false negatives found by auditing the live corpus', () => {
  // Every case here rejected a REAL, correct document in an audit run before the rule was added.
  it('accepts a state named by its abbreviation, as documents actually write it', () => {
    const identity = checkSubjectIdentity(
      'The Harry W. Gray House at 1005 South Quinn Street, Arlington, Arlington County, VA, was ' +
        'documented by the Historic American Buildings Survey. Gray built the house in 1881.',
      {
        displayName: 'Gray, Harry W., House',
        city: 'Arlington',
        county: 'Arlington',
        state: 'Virginia',
      },
      { title: 'Harry W. Gray House' },
    );
    assert.equal(identity.stateMatch, true);
    assert.equal(identity.corroborated, true);
  });

  it('matches a name across differing apostrophe placement', () => {
    const identity = checkSubjectIdentity(
      "The Wells'Built Museum of African American History and Culture occupies the former " +
        "Wells'Built Hotel in Orlando, Orange County, Florida, built in 1929 by Dr. William Wells.",
      {
        displayName: "Well'sbuilt Hotel",
        city: 'Orlando',
        county: 'Orange',
        state: 'Florida',
      },
      { title: "Wells'Built Museum" },
    );
    assert.equal(identity.corroborated, true);
  });

  it('carries a person row on name and focus alone, having no place to check', () => {
    const identity = checkSubjectIdentity(
      'Eliza Ann Gardner (1831-1922) was an abolitionist and a founder of the AME Zion missionary ' +
        'movement. Gardner ran a boarding house that sheltered freedom seekers.',
      { displayName: 'Eliza Ann Gardner' },
      { title: 'Eliza Ann Gardner (U.S. National Park Service)' },
    );
    assert.equal(identity.placeKnown, false);
    assert.equal(identity.corroborated, true);
  });

  it('still refuses a different person reached from that person’s page', () => {
    const identity = checkSubjectIdentity(
      'Frederick Douglass escaped slavery in 1838 and became the most prominent Black abolitionist ' +
        'of the nineteenth century. Douglass published the North Star in Rochester.',
      { displayName: 'Eliza Ann Gardner' },
      { title: 'Frederick Douglass' },
    );
    assert.equal(identity.corroborated, false);
  });

  it('does not read navigation chrome as a list announcement', () => {
    assert.equal(
      isIndexDocument(
        'Josephine St. Pierre Ruffin',
        'Home Search List of parks Josephine St. Pierre Ruffin was a publisher and civil rights ' +
          'activist in Boston.',
      ),
      false,
    );
  });
});

describe('a name that is only its own location cannot corroborate a document', () => {
  it('refuses a city page matched to a district named after that city', () => {
    const identity = checkSubjectIdentity(
      "Wilmington's Race to 100 inches! The National Weather Service office in Wilmington tracks " +
        'annual rainfall totals for New Hanover County, North Carolina.',
      {
        displayName: 'Wilmington Historic District',
        city: 'Wilmington',
        county: 'New Hanover',
        state: 'North Carolina',
      },
      { title: "Wilmington's Race to 100 inches!" },
    );
    assert.equal(identity.distinctiveTokens.length, 0);
    assert.equal(identity.corroborated, false);
    assert.match(identity.reason ?? '', /independent of its place/u);
  });

  it('keeps a district whose name adds a word of its own', () => {
    const identity = checkSubjectIdentity(
      'The Winston-Salem Tobacco Historic District comprises the R. J. Reynolds tobacco factory ' +
        'complex in Winston-Salem, Forsyth County, North Carolina. Tobacco processing here ' +
        'employed thousands of Black workers.',
      {
        displayName: 'Winston-Salem Tobacco Historic District',
        city: 'Winston-Salem',
        county: 'Forsyth',
        state: 'North Carolina',
      },
      { title: 'Winston-Salem Tobacco Historic District' },
    );
    assert.deepEqual(identity.distinctiveTokens, ['tobacco']);
    assert.equal(identity.corroborated, true);
  });
});

describe('administrative-geography words cannot carry identity either', () => {
  // Both survived the first version of the place-independence rule and reached a drafter, who
  // refused them (round 3, 2026-08-11). The place word is stripped and an equally empty
  // administrative word is left behind to satisfy the focus test.
  it('refuses a county article matched to a building named for that county', () => {
    const identity = checkSubjectIdentity(
      'Leon County is a county located in the Florida Panhandle. As of the 2020 census the ' +
        'population was 292,198. The county seat is Tallahassee. Leon County was created in 1824.',
      {
        displayName: 'Leon County Health Unit Building',
        city: 'Tallahassee',
        county: 'Leon',
        state: 'Florida',
      },
      { title: 'Leon County, Florida' },
    );
    // Which gate catches it depends on the document — the live evidence for this entity was
    // refused by three different ones (place, name, focus) across seven documents. The contract
    // under test is that none of them get through, not which rule does the work.
    assert.equal(identity.corroborated, false);
    assert.notEqual(identity.reason, undefined);
  });

  it('refuses a county government page matched to a town historic district', () => {
    const identity = checkSubjectIdentity(
      'Surry County, Virginia government. The county administrator’s office serves residents of ' +
        'the county. Surry County and the Town of Dendron signed an economic development MOU.',
      {
        displayName: 'Town of Surry Historic District',
        city: 'Surry',
        county: 'Surry',
        state: 'Virginia',
      },
      { title: 'Surry County, Virginia' },
    );
    assert.equal(identity.corroborated, false);
  });

  it('keeps a county-named property that has a real word of its own', () => {
    const identity = checkSubjectIdentity(
      'The Warren County Training School served Black students in Warrenton, Warren County, ' +
        'North Carolina, from 1925. The training school was one of the Rosenwald schools built ' +
        'across the county, and its graduates staffed classrooms throughout the region.',
      {
        displayName: 'Warren County Training School',
        city: 'Warrenton',
        county: 'Warren',
        state: 'North Carolina',
      },
      { title: 'Warren County Training School' },
    );
    assert.deepEqual(identity.distinctiveTokens, ['training']);
    assert.equal(identity.corroborated, true);
  });
});

describe('checkPlaceIdentity', () => {
  it('requires state AND locality when the roster has both', () => {
    const expected = { displayName: 'X', city: 'Covington', state: 'Virginia' };
    assert.equal(checkPlaceIdentity('Covington, Kentucky', expected).placeCorroborated, false);
    assert.equal(checkPlaceIdentity('Covington, Virginia', expected).placeCorroborated, true);
  });

  it('falls back to the state alone when the roster has no locality', () => {
    const identity = checkPlaceIdentity('a property in Mississippi', {
      displayName: 'X',
      state: 'Mississippi',
    });
    assert.equal(identity.placeCorroborated, true);
  });

  it('tolerates orthographic difference in place names ("De Kalb" / "DeKalb")', () => {
    const identity = checkPlaceIdentity('DeKalb County, Georgia', {
      displayName: 'X',
      county: 'De Kalb',
      state: 'Georgia',
    });
    assert.equal(identity.placeCorroborated, true);
  });
});

describe('isIndexDocument', () => {
  it('flags NRHP listings roll-ups by title', () => {
    assert.equal(
      isIndexDocument('National Register of Historic Places listings in Warren County, Georgia', ''),
      true,
    );
  });

  it('flags a page whose opening announces a list', () => {
    assert.equal(isIndexDocument('Warren County landmarks', 'This is a list of landmarks in...'), true);
  });

  it('does not flag ordinary prose', () => {
    assert.equal(isIndexDocument('Whitelaw Hotel', 'The Whitelaw Hotel is a historic building.'), false);
  });
});

describe('significantNameTokens', () => {
  it('drops the structural nouns that match almost any roster entry', () => {
    assert.deepEqual(significantNameTokens('Jude, George, House'), ['jude', 'george']);
  });

  it('keeps denominational and personal words that actually identify', () => {
    assert.deepEqual(significantNameTokens('First Baptist Church'), ['first', 'baptist']);
  });
});

/**
 * repo-u84y. Same convention as the repo-ppeu cases above: every negative below is written from a
 * document that was really attached to that entity and really passed the old gate, because a
 * synthetic "obviously wrong" fixture would have passed the old code too and so proves nothing.
 */
describe('countWholeWord / containsWholeWord (repo-u84y defect 1: substring matching)', () => {
  it('does not let "quarters" match "headquarters"', () => {
    const folded = foldPunctuation('the seat of many global and european corporate headquarters');
    assert.equal(countWholeWord(folded, 'quarters'), 0);
    assert.equal(containsWholeWord(folded, 'quarters'), false);
  });

  it('does not let "catholic" match "catholicism"', () => {
    const folded = foldPunctuation('religions such as islam protestantism catholicism and spiritualism');
    assert.equal(containsWholeWord(folded, 'catholic'), false);
  });

  it('still counts genuine repeats, including adjacent ones', () => {
    const folded = foldPunctuation('Hogan Hogan and Hogan, attorneys');
    assert.equal(countWholeWord(folded, 'hogan'), 3);
  });

  it('treats a possessive as the same word', () => {
    // foldPunctuation drops the apostrophe, so a strict whole-word test refused the Wikipedia
    // article on St. Joseph's AME Church as evidence for St. Joseph AME Church.
    const folded = foldPunctuation("St. Joseph's African Methodist Episcopal Church");
    assert.equal(containsWholeWord(folded, 'joseph'), true);
  });

  it('does not treat a longer word as a possessive of a shorter one', () => {
    const folded = foldPunctuation('corporate headquarters');
    assert.equal(containsWholeWord(folded, 'quarter'), false);
  });
});

describe('nameTokensCooccur (repo-u84y defect 2: a name is a phrase, not a bag of words)', () => {
  it('rejects a roster carrying the name’s words far apart', () => {
    // The shape of "African American officeholders ... until before 1900", which supplied 61
    // instances of "thomas" and 17 of "isaac" — all different people.
    const folded = foldPunctuation(
      'Isaac Burton served in the South Carolina House. ' +
        'A long stretch of unrelated roster text separates these entries, listing legislators from ' +
        'several states across two decades of Reconstruction government and the years after it. ' +
        'Thomas Walker represented Alabama in the state assembly.',
    );
    assert.equal(nameTokensCooccur(folded, ['keys', 'thomas', 'isaac']), false);
  });

  it('accepts a document that writes the name as a name', () => {
    const folded = foldPunctuation('The Keys, Thomas Isaac, House is a historic home in Pearlington.');
    assert.equal(nameTokensCooccur(folded, ['keys', 'thomas', 'isaac']), true);
  });

  it('does not require every component to be present', () => {
    // Measured false negative from a first version of this rule: the NPS biography of Wharlest
    // Jackson is real evidence for "Jackson, Wharlest and Exerlena, House" and never names the wife.
    const folded = foldPunctuation('Wharlest Jackson was a civil rights activist murdered in 1967.');
    assert.equal(nameTokensCooccur(folded, ['jackson', 'wharlest', 'exerlena']), true);
  });

  it('needs at least two present tokens to say anything', () => {
    const folded = foldPunctuation('Jackson is a common surname.');
    assert.equal(nameTokensCooccur(folded, ['jackson', 'wharlest', 'exerlena']), false);
  });
});

describe('checkSubjectIdentity rejects the measured repo-u84y mismatches', () => {
  it('rejects an article about Frankfurt, Germany as evidence for Hogan Quarters', () => {
    const identity = checkSubjectIdentity(
      'Frankfurt am Main, usually shortened to Frankfurt, is the most populous city in the German ' +
        'state of Hesse. It is the seat of many global and european corporate headquarters due to ' +
        'its central location. Law firms including Hogan Lovells, Jones Day and Latham Watkins ' +
        'maintain offices in the city, which lies on the Main river in Mississippi-like lowlands.',
      { displayName: 'Hogan Quarters', city: 'Pearlington', state: 'Mississippi' },
      { title: 'Frankfurt' },
    );
    // Rejected on place here; the live row also matched place and was then rejected on the name
    // rule, which the next case covers with place deliberately satisfied.
    assert.equal(identity.corroborated, false);
  });

  it('rejects a roster of officeholders even when place agrees, because the name never appears', () => {
    const identity = checkSubjectIdentity(
      'African American officeholders from the end of the Civil War until before 1900. ' +
        'Isaac Burton served in the South Carolina House during Reconstruction. ' +
        'A long stretch of unrelated roster entries separates these names, covering legislators ' +
        'from Mississippi, Hancock County and many other states across two decades of ' +
        'Reconstruction government and the years that followed it in Pearlington and elsewhere. ' +
        'Thomas Walker represented Alabama in the state assembly.',
      {
        displayName: 'Keys, Thomas Isaac, House',
        city: 'Pearlington',
        county: 'Hancock',
        state: 'Mississippi',
      },
      { title: 'African American officeholders from the end of the Civil War until before 1900' },
    );
    assert.equal(identity.placeCorroborated, true);
    assert.equal(identity.corroborated, false);
    assert.match(identity.reason ?? '', /never together as a name/u);
  });

  it('rejects a disability-rights timeline whose only hit is the Hosanna-Tabor case', () => {
    const identity = checkSubjectIdentity(
      'This disability rights timeline lists events relating to the civil rights of people with ' +
        'disabilities in the United States. In 2012 in Hosanna Tabor the Supreme Court faced the ' +
        'ministerial exception. Maryland courts had considered the question earlier.',
      { displayName: 'Hosanna Church and Cemetery', city: 'Darlington', state: 'Maryland' },
      { title: 'Timeline of disability rights in the United States' },
    );
    assert.equal(identity.corroborated, false);
  });

  it('still accepts a document that is genuinely about the subject', () => {
    const identity = checkSubjectIdentity(
      'The Okmulgee Colored Hospital opened in 1924 and served African American patients in ' +
        'Okmulgee, Oklahoma until 1956. The Okmulgee Colored Hospital was one of few such ' +
        'institutions in the state, and the hospital trained nurses locally.',
      { displayName: 'Okmulgee Colored Hospital', city: 'Okmulgee', state: 'Oklahoma' },
      { title: 'Okmulgee Colored Hospital' },
    );
    assert.equal(identity.corroborated, true);
  });
});
