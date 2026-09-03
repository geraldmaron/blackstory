/**
 * The twenty facts chapter 3 draws from, one per visit.
 *
 * The chapter was a single fixed paragraph about the Great Migration. A reader who came back saw
 * the same sentence, which makes the story feel like a brochure rather than an archive. Twenty
 * entries, one shown per visit, is the same argument made twenty ways.
 *
 * Every entry carries its own source. That is the constraint that makes rotation safe: a fact
 * without a citation is exactly the kind of unsourced assertion the rest of the site refuses to
 * publish, and it would be worse here than anywhere because the story is what a first-time reader
 * meets before they have any reason to trust the archive. A `source` is a specific work or agency
 * publication, never "historians agree".
 *
 * These are facts about the shape of the Great Migration and the record it left, not claims about
 * individual records in the release. Nothing here is derived from the catalog, so nothing here
 * drifts when the release changes.
 */

export type StoryFact = {
  readonly id: string;
  /** Two to four sentences. The chapter's whole body. */
  readonly prose: string;
  /** Short pairs shown under the prose. Keep to three. */
  readonly figures: readonly { readonly value: string; readonly label: string }[];
  /** The work this rests on. Cited in the chapter, verbatim. */
  readonly source: string;
  /**
   * Where on the plate the fact is about, and how close to sit.
   *
   * A rotating fact with no place would leave the camera wherever the previous chapter left it,
   * so the map would be showing one thing while the card talked about another. Every entry names
   * its own geography: the Delta for the Illinois Central, the Bay for the shipyards, the whole
   * country for a fact about the census.
   */
  readonly camera: { readonly center: readonly [number, number]; readonly zoom: number };
  /** Said aloud in the camera readout, so the move announces what it is showing. */
  readonly placeLabel: string;
};

export const STORY_FACTS: readonly StoryFact[] = [
  {
    id: 'six-million',
    prose:
      'Between 1910 and 1970 about six million people left the South. The corridors were not random: rail lines and kin networks decided who landed in Chicago and who landed in Los Angeles. Records cluster at both ends of every line, which is why a Mississippi surname turns up in a Milwaukee school register.',
    figures: [
      { value: '1910 to 1970', label: 'the period' },
      { value: 'Six million', label: 'people who left' },
    ],
    source: 'Isabel Wilkerson, The Warmth of Other Suns (2010).',
    camera: { center: [-88.2, 37.6], zoom: 4.05 },
    placeLabel: 'the migration corridors',
  },
  {
    id: 'illinois-central',
    prose:
      'The Illinois Central ran straight up the spine of the Delta into Chicago, and the migration followed the timetable. Mississippi, Tennessee and Arkansas emptied northward along one railroad while Georgia and the Carolinas moved up the seaboard to Philadelphia and New York. Two different souths became two different norths.',
    figures: [
      { value: 'Illinois Central', label: 'the Delta line' },
      { value: 'Chicago', label: 'the northern terminus' },
    ],
    source: 'James N. Gregory, The Southern Diaspora (2005).',
    camera: { center: [-90.05, 33.4], zoom: 5.4 },
    placeLabel: 'the Mississippi Delta',
  },
  {
    id: 'defender',
    prose:
      'The Chicago Defender was carried south by Pullman porters and passed hand to hand, and it printed train schedules next to job listings. Southern towns banned it. A newspaper is why a particular family left in a particular month, which is the kind of cause that rarely survives into a record.',
    figures: [
      { value: 'The Chicago Defender', label: 'carried south by porters' },
      { value: '1917', label: 'the Great Northern Drive' },
    ],
    source: 'Ethan Michaeli, The Defender (2016).',
    camera: { center: [-87.63, 41.88], zoom: 9.2 },
    placeLabel: 'Chicago',
  },
  {
    id: 'first-and-second',
    prose:
      'There were two waves, not one. The first, roughly 1910 to 1940, was pulled north by wartime factory labor shortages. The second, after 1940, was larger, ran further west, and met a housing market that had spent the interval learning how to exclude.',
    figures: [
      { value: '1910 to 1940', label: 'first wave' },
      { value: '1940 to 1970', label: 'second wave' },
    ],
    source: 'Nicholas Lemann, The Promised Land (1991).',
    camera: { center: [-93.0, 38.5], zoom: 3.7 },
    placeLabel: 'the South and the North',
  },
  {
    id: 'mechanical-picker',
    prose:
      'The mechanical cotton picker did in a generation what no argument had. One machine could do the work of dozens of hands, and the plantation labor system that had held people in place stopped needing them. Departure was a decision, but the ground it was made on had moved.',
    figures: [
      { value: '1944', label: 'first commercial picker' },
      { value: 'Delta', label: 'where it landed first' },
    ],
    source: 'Nicholas Lemann, The Promised Land (1991).',
    camera: { center: [-90.5, 34.0], zoom: 6.4 },
    placeLabel: 'the Delta cotton country',
  },
  {
    id: 'restrictive-covenants',
    prose:
      'Arrival was not admission. Deeds across northern and western cities carried covenants barring sale or occupancy by Black buyers, and they were enforced by neighbors and by courts until Shelley v. Kraemer in 1948. Where a family could land was written into the paperwork of the land itself.',
    figures: [
      { value: '1948', label: 'Shelley v. Kraemer' },
      { value: 'Deeds', label: 'where the bar was written' },
    ],
    source: 'Richard Rothstein, The Color of Law (2017).',
    camera: { center: [-90.2, 38.63], zoom: 9.6 },
    placeLabel: 'St. Louis',
  },
  {
    id: 'holc-maps',
    prose:
      'The Home Owners Loan Corporation graded neighborhoods for mortgage risk in the 1930s and colored the Black ones red. The maps were internal, but the practice they described outlived them by decades and shaped which blocks got loans, which got repairs, and which got nothing.',
    figures: [
      { value: '1935 to 1940', label: 'the surveys' },
      { value: '239', label: 'cities mapped' },
    ],
    source: 'Richard Rothstein, The Color of Law (2017).',
    camera: { center: [-83.05, 42.33], zoom: 9.4 },
    placeLabel: 'Detroit',
  },
  {
    id: 'sundown-towns',
    prose:
      'Thousands of towns outside the South excluded Black residents after dark, by ordinance, by sign, or by the certainty of what would happen. The migration routes bend around them. A corridor drawn on this map is partly a record of where people could not stop.',
    figures: [
      { value: 'Thousands', label: 'towns documented' },
      { value: 'Midwest', label: 'densest concentration' },
    ],
    source: 'James W. Loewen, Sundown Towns (2005).',
    camera: { center: [-89.2, 39.8], zoom: 5.6 },
    placeLabel: 'the Midwest',
  },
  {
    id: 'great-migration-west',
    prose:
      'The wartime shipyards pulled the migration west. Oakland, Richmond, Portland and Los Angeles took hundreds of thousands of people from Texas, Louisiana and Arkansas in a few years, into cities with almost no existing Black neighborhoods and almost no housing willing to hold them.',
    figures: [
      { value: '1942 to 1945', label: 'the shipyard years' },
      { value: 'Bay Area', label: 'fastest growth' },
    ],
    source: 'Albert S. Broussard, Black San Francisco (1993).',
    camera: { center: [-122.3, 37.85], zoom: 8.8 },
    placeLabel: 'the Bay Area shipyards',
  },
  {
    id: 'return-migration',
    prose:
      'The direction reversed. From the 1970s onward more Black Americans moved to the South than left it, and the return has continued since. Atlanta, Charlotte and Houston grew on people whose grandparents had boarded a train the other way.',
    figures: [
      { value: '1970s', label: 'the reversal' },
      { value: 'Atlanta', label: 'largest destination' },
    ],
    source: 'William H. Frey, Diversity Explosion (2015).',
    camera: { center: [-84.39, 33.75], zoom: 8.6 },
    placeLabel: 'Atlanta',
  },
  {
    id: 'church-records',
    prose:
      'Black churches kept the records the state did not. Minutes, burial books, building funds and membership rolls are often the only surviving documentation of a community, and a congregation that moved north carried its paperwork with it. A church archive is frequently the earliest evidence a place existed at all.',
    figures: [
      { value: 'Minutes and rolls', label: 'what survived' },
      { value: 'Congregations', label: 'who kept them' },
    ],
    source: 'Records of Antebellum Southern Plantations, Library of Congress finding aids.',
    camera: { center: [-80.0, 32.78], zoom: 9.0 },
    placeLabel: 'the Carolina low country',
  },
  {
    id: 'rosenwald',
    prose:
      'Between 1912 and 1932 nearly five thousand schools were built for Black children across the rural South, funded partly by Julius Rosenwald and substantially by the communities themselves, who raised money they were already being taxed for. The buildings are gone in most counties. The subscription lists are not.',
    figures: [
      { value: '4,978', label: 'schools built' },
      { value: '1912 to 1932', label: 'the program' },
    ],
    source: 'Fisk University Rosenwald Fund Card File Database.',
    camera: { center: [-86.8, 32.4], zoom: 6.2 },
    placeLabel: 'the rural South',
  },
  {
    id: 'green-book',
    prose:
      'The Negro Motorist Green Book listed the places that would serve a Black traveller, edition by edition, from 1936 to 1966. Read across editions it is a map of where the country was closed, and its entries are often the only surviving record that a particular business existed.',
    figures: [
      { value: '1936 to 1966', label: 'editions published' },
      { value: 'Motels and cafes', label: 'what it listed' },
    ],
    source: 'The Negro Motorist Green Book, New York Public Library Digital Collections.',
    camera: { center: [-73.94, 40.81], zoom: 10.2 },
    placeLabel: 'Harlem',
  },
  {
    id: 'freedmens-bureau',
    prose:
      'The Freedmen’s Bureau recorded labor contracts, marriages, rations and complaints between 1865 and 1872. It is the densest surviving documentation of the first years after emancipation, and for many families it holds the earliest record in which they appear by full name.',
    figures: [
      { value: '1865 to 1872', label: 'the Bureau years' },
      { value: 'Labor contracts', label: 'the bulk of it' },
    ],
    source: 'Freedmen’s Bureau Records, National Archives (Record Group 105).',
    camera: { center: [-77.03, 38.9], zoom: 9.4 },
    placeLabel: 'the District of Columbia',
  },
  {
    id: 'census-undercount',
    prose:
      'The census has undercounted Black Americans in every enumeration it has measured itself against. The gap is largest for young Black men and largest in exactly the places with the least other documentation, so the thinnest part of the record is thin twice over.',
    figures: [
      { value: 'Every census', label: 'measured undercount' },
      { value: 'Young men', label: 'largest gap' },
    ],
    source: 'U.S. Census Bureau, Post-Enumeration Survey coverage measurement reports.',
    camera: { center: [-96.5, 38.6], zoom: 3.4 },
    placeLabel: 'the whole country',
  },
  {
    id: 'destroyed-records',
    prose:
      'Courthouse fires, floods and deliberate destruction removed whole counties from the record. Where a deed book burned, the ownership it recorded became unprovable, and the loss almost always fell hardest on the people with the least ability to reconstruct it from elsewhere.',
    figures: [
      { value: 'Deed books', label: 'what was lost' },
      { value: 'Counties', label: 'the unit of loss' },
    ],
    source: 'National Archives, guides to lost and destroyed county records.',
    camera: { center: [-84.0, 33.0], zoom: 5.8 },
    placeLabel: 'the Georgia counties',
  },
  {
    id: 'national-register',
    prose:
      'The National Register of Historic Places is one of the richest sources here, and one of the most uneven. Listing requires someone to research and file a nomination, so the Register records not only what survived but who had the time, money and standing to argue that it mattered.',
    figures: [
      { value: 'Nominations', label: 'how a place is listed' },
      { value: 'Uneven', label: 'what that makes it' },
    ],
    source: 'National Register of Historic Places, National Park Service.',
    camera: { center: [-96.5, 38.6], zoom: 3.5 },
    placeLabel: 'the whole country',
  },
  {
    id: 'hbcus',
    prose:
      'The historically Black colleges founded after emancipation are among the best documented institutions in this archive, because they kept registers, catalogs and alumni records continuously for a century and more. They anchor the map in places where almost nothing else was written down.',
    figures: [
      { value: 'After 1865', label: 'most were founded' },
      { value: 'Registers', label: 'what they kept' },
    ],
    source: 'U.S. Department of Education, White House Initiative on HBCUs.',
    camera: { center: [-86.8, 36.16], zoom: 8.6 },
    placeLabel: 'Nashville',
  },
  {
    id: 'red-summer',
    prose:
      'The violence of 1919 followed the migration routes. Attacks broke out in more than two dozen cities in a single year, concentrated where wartime arrivals had changed who lived on which block. The pattern is geographic, and it maps onto the corridors almost exactly.',
    figures: [
      { value: '1919', label: 'the year' },
      { value: 'Two dozen cities', label: 'documented attacks' },
    ],
    source: 'Cameron McWhirter, Red Summer (2011).',
    camera: { center: [-87.63, 41.85], zoom: 8.9 },
    placeLabel: 'Chicago, 1919',
  },
  {
    id: 'oral-history',
    prose:
      'For much of this period the only account of a life is the one someone recorded by voice. Oral history projects hold what no register captured, and they are also the most fragile part of the record: a tape degrades, a project loses funding, and the last person who could have told it is already gone.',
    figures: [
      { value: 'Interviews', label: 'the surviving account' },
      { value: 'Fragile', label: 'the format' },
    ],
    source:
      'Smithsonian National Museum of African American History and Culture, oral history collections.',
    camera: { center: [-90.18, 32.3], zoom: 7.4 },
    placeLabel: 'Mississippi',
  },
];

export function storyFactById(id: string): StoryFact | undefined {
  return STORY_FACTS.find((fact) => fact.id === id);
}

/**
 * `roll` is any number in [0, 1). Passed in rather than drawn here so the chapter shows one fact
 * for the length of a visit instead of a new one on every render, and so a test can pin the choice.
 */
export function pickStoryFact(roll: number): StoryFact {
  const bounded = Number.isFinite(roll) ? Math.min(Math.max(roll, 0), 0.999999) : 0;
  return STORY_FACTS[Math.floor(bounded * STORY_FACTS.length)] ?? STORY_FACTS[0]!;
}
