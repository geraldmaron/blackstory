/**
 * Inventors named on the invention cohort who had no person record in this catalog.
 *
 * The first invention cohort named twenty contributions and linked none of them to a person,
 * because four of the people it centers were not in `bb_canonical.entities` at all: an invention
 * page could not reach its inventor, and the inventor had no page to reach. The second cohort
 * named eight more. Every other name on those receipts either already has a record or is
 * deliberately not modeled (see `InventionContributor` in `./invention-cohort.ts`).
 *
 * Scope discipline matches the invention cohort. Each summary says what the person is documented
 * to have done, and stops. Where a claim is commonly repeated but rests on the limits of the
 * surviving record — "first" claims especially — it is written as the record actually supports
 * it, not as the slogan.
 *
 * `personReviewApproved` in `../lib/incremental-publish.ts` blocks every person row from
 * incremental publish until `payload.personReview` records approved/approvedBy/approvedAt/basis.
 * Eleven of the twelve are long-deceased historical figures, and each basis names the death date
 * and where it is published, or, where no death date survives (Reed, Newman), the birth-era
 * evidence that rules out a living person. The staging script writes that marker rather than
 * leaving rows stranded pending on a fact nobody disputes. Lonnie G. Johnson is living: his row
 * records `livingStatus: 'living'`, a basis naming his public professional standing, and carries
 * no residence, birth date or family detail, with the anchor capped at city precision per
 * `docs/security/location-precision-standard.md`.
 */
export type InventorCohortRecord = {
  readonly id: string;
  readonly displayName: string;
  readonly summary: string;
  readonly historicalContext: string;
  readonly city: string;
  readonly state: string;
  readonly lat: number;
  readonly lng: number;
  readonly era: string;
  readonly canonicalUrl: string;
  /** The invention records this person is named on, for the reviewer's benefit. */
  readonly namedOn: readonly string[];
  /**
   * The `basis` string recorded in `payload.personReview`, which is what the privacy gate in
   * `../lib/incremental-publish.ts` actually weighs. It has to state the evidence that this is a
   * deceased historical figure rather than a living private person, so it names the death date
   * and where it is published — not "reviewed" with nothing behind it.
   */
  readonly reviewBasis: string;
  /**
   * Recorded into `payload.personReview.livingStatus`, which the publisher and the canonical
   * upsert read. Absent means deceased, because every basis without it names a death date or the
   * birth-era evidence that rules a living person out. A living subject must say so here so the
   * privacy posture (city-precision cap, no residence) is derived from the record, not assumed.
   */
  readonly livingStatus?: 'living' | 'deceased';
  readonly evidence: readonly {
    readonly sourceUrl: string;
    readonly title: string;
    readonly quote: string;
  }[];
};

export const INVENTOR_COHORT: readonly InventorCohortRecord[] = [
  {
    id: 'ent_benjamin_banneker_001',
    displayName: 'Benjamin Banneker',
    summary:
      'Benjamin Banneker (1731–1806) was a free Black farmer, astronomer and almanac author in the Patapsco valley of Maryland, in what is now the Ellicott City area. He built a wooden striking clock in the early 1750s, calculated ephemerides for a series of almanacs published in the 1790s, and worked for the survey of the federal district in early 1791, helping fix its south corner at Jones Point before leaving the party. In 1791 he sent Thomas Jefferson a manuscript almanac with a letter arguing against the claim that Black people lacked the capacity for such work, and Jefferson replied. He held no patent; the patent system of his lifetime was not open to him in the way it was to later free citizens, and the clock and the almanacs are documented by contemporary accounts rather than by a grant.',
    historicalContext:
      'Banneker is the case that keeps the invention catalog honest about receipts. An invention with no Patent Office record is still an invention, and treating the absence of a grant as a gap in his life would misstate the eighteenth century rather than describe it. The Ellicott City anchor is the farm country he worked, held at city precision, not a house.',
    city: 'Ellicott City',
    state: 'MD',
    lat: 39.2673,
    lng: -76.7983,
    era: '1750s',
    canonicalUrl: 'https://www.nps.gov/articles/000/nama-notebook-benjamin-banneker.htm',
    namedOn: ['inv_banneker_striking_clock'],
    reviewBasis:
      'Deceased historical figure: Benjamin Banneker died 9 October 1806. Death date published by the National Park Service and in standard reference works; no living-person privacy interest.',
    evidence: [
      {
        sourceUrl: 'https://www.nps.gov/places/000/benjamin-banneker-park.htm',
        title: 'Benjamin Banneker Park (U.S. National Park Service)',
        quote:
          'He gained early recognition for constructing a wooden clock that kept accurate time for decades, and later for publishing a series of almanacs that showcased his astronomical calculations and weather predictions.',
      },
      {
        sourceUrl:
          'https://prologue.blogs.archives.gov/2025/02/26/the-extraordinary-benjamin-banneker/',
        title: 'The Extraordinary Benjamin Banneker — Pieces of History',
        quote:
          'He lived on his family’s 100-acre farm near present-day Ellicott City his entire life.',
      },
      {
        sourceUrl: 'https://guides.loc.gov/benjamin-banneker/digital-resources',
        title: 'Benjamin Banneker: A Resource Guide — Digital Resources',
        quote:
          "Jefferson and Banneker had been in contact previously, and the future president had been so impressed by Banneker's skills that he had recommended him for employment as an assistant surveyor of the new federal district.",
      },
    ],
  },
  {
    id: 'ent_miriam_e_benjamin_001',
    displayName: 'Miriam E. Benjamin',
    summary:
      'Miriam E. Benjamin (1861–1947) was a schoolteacher in Washington, D.C., who received US 386,289 for a gong and signal chair on 17 July 1888. The chair let a seated person summon an attendant by pressing a device that sounded a gong and raised a signal, and she pressed for its adoption in the United States House of Representatives. Henry E. Baker, the Patent Office examiner who compiled lists of patents issued to Black inventors, carried her grant as evidence against the claim that Black Americans did not invent. Women patentees preceded her, including Judy W. Reed in 1884, and the House did not adopt her chair; it installed a different call system in 1895.',
    historicalContext:
      "Baker's compilation is a document about who he could confirm from Patent Office records, not a census of Black patentees. Benjamin's grant is one chair-and-gong device. Reading her as the only Black woman ever to hold a US patent repeats a limitation of his sources as though it were a fact about the country, and the House's own historian records that her lobbying did not carry.",
    city: 'Washington',
    state: 'DC',
    lat: 38.9072,
    lng: -77.0369,
    era: '1880s',
    canonicalUrl: 'https://patents.google.com/patent/US386289A',
    namedOn: ['inv_benjamin_gong_signal_chair'],
    reviewBasis:
      'Deceased historical figure: Miriam E. Benjamin died in 1947. Nineteenth-century patentee with a published grant (US 386,289, 1888); no living-person privacy interest.',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US386289A',
        title: 'US 386,289',
        quote: 'Gong and signal chair',
      },
      {
        sourceUrl: 'https://history.house.gov/Blog/2013/December/12-17-Buzzer/',
        title: "What's Buzzing in the Chamber?",
        quote:
          'Benjamin was a schoolteacher in Washington, and she lobbied for adoption of her invention in the House.',
      },
      {
        sourceUrl:
          'https://www.blackpast.org/african-american-history/benjamin-miriam-e-1861-1947/',
        title: 'Miriam E. Benjamin (1861-1947)',
        quote:
          'At the time of her application, Benjamin was living in Washington, D.C., working as an educator in the city’s public schools.',
      },
    ],
  },
  {
    id: 'ent_henry_t_sampson_001',
    displayName: 'Henry T. Sampson',
    summary:
      'Henry T. Sampson (1934–2015) was a nuclear engineer and a historian of early Black cinema. He is named with George H. Miley on US 3,591,860, a gamma-electric cell granted on 6 July 1971, which converts gamma radiation into electricity. He earned a doctorate in nuclear engineering at the University of Illinois in 1967, widely cited as the first awarded to a Black American in that field, and worked for years at the Aerospace Corporation. He also assembled one of the first substantial archives and reference works on Black film before 1950. He did not invent the cellular telephone; that attribution is a later internet claim and nothing on his patents supports it.',
    historicalContext:
      'The cellular-phone story is the reason this record exists in the shape it does. Sampson has a documented career in nuclear engineering and in film history, and repeating a myth about him displaces both. The gamma-electric cell names two inventors and this catalog keeps Miley on the receipt without opening a record for him.',
    city: 'Urbana',
    state: 'IL',
    lat: 40.1106,
    lng: -88.2073,
    era: '1970s',
    canonicalUrl: 'https://patents.google.com/patent/US3591860A',
    namedOn: ['inv_sampson_miley_gamma_cell'],
    reviewBasis:
      'Deceased historical figure: Henry T. Sampson died 4 June 2015. Published obituaries and a public engineering and publishing career; no living-person privacy interest.',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US3591860A',
        title: 'US 3,591,860',
        quote: 'Gamma-electric cell',
      },
      {
        sourceUrl: 'https://engineering.purdue.edu/150/Consequential-Stories/150th-henry-sampson',
        title:
          'Inventor of the gamma-electric cell — and first African American PhD in nuclear engineering',
        quote:
          'In 1961, Sampson embarked on graduate studies, receiving two master’s degrees, and became the first African American to earn a PhD in nuclear engineering in the U.S. (from the University of Illinois Urbana-Champaign in 1967).',
      },
      {
        sourceUrl: 'https://grainger.illinois.edu/alumni/distinguished/Henry-Sampson',
        title: 'Henry T. Sampson — Distinguished Alumni, The Grainger College of Engineering',
        quote:
          'Among Sampson’s most notable engineering accomplishments is his co-invention of the gamma electric cell, patented in 1971.',
      },
    ],
  },
  {
    id: 'ent_george_w_murray_001',
    displayName: 'George W. Murray',
    summary:
      'George Washington Murray (1853–1926) was born enslaved in Sumter County, South Carolina, taught school, farmed, and served in the United States House of Representatives in the 1890s, as the only Black member of the chamber in both of his terms. He received patents on agricultural implements, including US 520,890 for a planter granted in 1894. In the same period he read into the Congressional Record a compilation of patents issued to Black inventors, using the list as an argument on the floor against claims about Black capacity. The planter and the list are two separate documents, and this catalog holds them apart so each carries its own weight.',
    historicalContext:
      'Murray sits at the join between the invention catalog and the political record: a farming implement, a congressional seat held while Black representation in the South was being dismantled, and a list of patents entered as testimony. Folding the list into the machine, or the machine into the biography, loses what each one was for.',
    city: 'Sumter',
    state: 'SC',
    lat: 33.9204,
    lng: -80.3415,
    era: '1890s',
    canonicalUrl: 'https://patents.google.com/patent/US520890A',
    namedOn: ['inv_murray_planter'],
    reviewBasis:
      'Deceased historical figure: George Washington Murray died 21 April 1926. Member of the US House of Representatives with an entry in the Biographical Directory of Congress; no living-person privacy interest.',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US520890A',
        title: 'US 520,890',
        quote: 'Planter',
      },
      {
        sourceUrl: 'https://history.house.gov/People/Detail/18709',
        title: 'MURRAY, George Washington — Extended Biography',
        quote:
          'Working as a farmer, a teacher, and a lecturer in Sumter County, Murray obtained eight patents for various agricultural tools.',
      },
      {
        sourceUrl: 'https://guides.loc.gov/african-american-innovation/Individuals-pre-1865',
        title: 'African American Innovation, Invention, and Entrepreneurship — Henry E. Baker',
        quote:
          'He compiled the information he received into a lengthy list, ultimately read on the House floor by Rep. George Washington Murray, and in 1913 published a short book titled The Colored Inventor: A Record of Fifty Years.',
      },
      {
        sourceUrl: 'https://guides.law.sc.edu/EqualRights/MurrayGeorgeWashington',
        title: 'George Washington Murray — All for Civil Rights (USC School of Law)',
        quote: 'In 1853, George W. Murray was born a slave in Sumter County.',
      },
    ],
  },
  {
    id: 'ent_jan_ernst_matzeliger_001',
    displayName: 'Jan Ernst Matzeliger',
    summary:
      'Jan Ernst Matzeliger (1852-1889) built shoe machinery in Lynn, Massachusetts. Born in what is now Paramaribo, Suriname, he worked as a sailor on a merchant ship, settled in Philadelphia in 1873, and by 1877 had moved to Lynn as an apprentice in a shoe factory. He built his first model of a lasting machine out of wooden cigar boxes, elastic and wire, and received US 274,207 for it on 20 March 1883, having already assigned two-thirds of the grant to Melville S. Nichols and Charles H. Delnow of Lynn. He kept improving the machine until it could produce 700 pairs of shoes a day, against about 50 for a skilled hand laster. He held stock in the Consolidated Lasting Machine Co. and died of tuberculosis in 1889, a month short of 37; the United Shoe Machinery Co. took his patent and his stock afterward.',
    historicalContext:
      'The patent prints his middle name as Earnst and every institution that keeps a page on him prints Ernst, so this record carries the institutional form and reports the patent spelling rather than silently choosing one. The scope discipline is the second thing the record holds: he assigned two-thirds of the grant before it issued and was dead six years later, so the industry consolidation and the fortune that followed belong to companies, not to him.',
    city: 'Lynn',
    state: 'MA',
    lat: 42.4668,
    lng: -70.9495,
    era: '1880s',
    canonicalUrl: 'https://www.invent.org/inductees/jan-ernst-matzeliger',
    namedOn: ['inv_matzeliger_lasting_machine'],
    reviewBasis:
      'Deceased historical figure: Jan Ernst Matzeliger died 24 August 1889. The death date is published by the National Inventors Hall of Fame on his inductee page, which records "Born Sept. 15, 1852 - Died Aug. 24, 1889"; no living-person privacy interest.',
    evidence: [
      {
        sourceUrl: 'https://www.invent.org/inductees/jan-ernst-matzeliger',
        title: 'Jan Ernst Matzeliger - National Inventors Hall of Fame',
        quote:
          'In 1873, he settled in Philadelphia, and by 1877 he had moved to Lynn, Massachusetts, where he became an apprentice in a shoe factory.',
      },
      {
        sourceUrl: 'https://www.invent.org/inductees/jan-ernst-matzeliger',
        title: 'Jan Ernst Matzeliger - National Inventors Hall of Fame',
        quote: 'Born Sept. 15, 1852 - Died Aug. 24, 1889',
      },
      {
        sourceUrl:
          'https://lynnmuseum.org/2021/03/01/lynn-museum-to-open-new-exhibit-on-black-historical-figures-of-lynn/',
        title:
          'Lynn Daily Item Highlights Historical Figures in "Untold Stories" Exhibition - Lynn Museum',
        quote:
          'The exhibition includes original documents of freed and traded enslaved people, including Lewis Latimer, inventor of the light bulb, and Jan Ernst Matzeliger, inventor of a shoe lasting machine that is still used today.',
      },
      {
        sourceUrl: 'https://patents.google.com/patent/US274207A',
        title: 'US 274,207',
        quote: 'JAN EARNST MATZELIGER, OF LYNN, MASSACHUSETTS',
      },
    ],
  },
  {
    id: 'ent_joseph_lee_001',
    displayName: 'Joseph Lee',
    summary:
      'Joseph Lee (1849-1908) was a cook, baker and hotel and restaurant owner in the Boston area. Born in South Carolina and enslaved for the first ten years of his life, he worked as a blacksmith during the Civil War, then as a servant, and then for eleven years as a steward in the US Coast Survey, where the work was cooking and baking. By the early 1880s the self-educated Lee owned and operated a number of restaurants, hotels and catering establishments around Boston. In 1894 he filed for his first patent, on the kneading machine granted as US 524,042; he patented a bread crumbing machine in 1895 and an improvement to the bread machine in 1902. He assigned the kneading machine rights to The National Bread Co. and sold the crumbing machine to The Goodell Co. of New Hampshire.',
    historicalContext:
      "Lee's two bread machines are routinely folded into one another, so this record names them separately and dates each. The anchor follows the trade rather than the paperwork: the Hall of Fame documents his restaurants, hotels and catering business in the Boston area, while Auburndale, the village of Newton on the patent, is the residence the filing lists.",
    city: 'Boston',
    state: 'MA',
    lat: 42.3601,
    lng: -71.0589,
    era: '1890s',
    canonicalUrl: 'https://www.invent.org/inductees/joseph-lee',
    namedOn: ['inv_lee_kneading_machine'],
    reviewBasis:
      'Deceased historical figure: Joseph Lee died 11 June 1908. The death date is published by the National Inventors Hall of Fame on his inductee page, which records "Born 1849 - Died June 11, 1908"; no living-person privacy interest.',
    evidence: [
      {
        sourceUrl: 'https://www.invent.org/inductees/joseph-lee',
        title: 'Joseph Lee - National Inventors Hall of Fame',
        quote:
          'By the early 1880s, the self-educated Lee had become a successful entrepreneur. He owned and operated a number of restaurants, hotels and catering establishments in the Boston area.',
      },
      {
        sourceUrl: 'https://www.invent.org/inductees/joseph-lee',
        title: 'Joseph Lee - National Inventors Hall of Fame',
        quote: 'Born 1849 - Died June 11, 1908',
      },
      {
        sourceUrl: 'https://legacyquiltproject.mofad.org/quilt/joseph-lee/',
        title: 'Museum of Food and Drink, Legacy Quilt: Joseph Lee',
        quote:
          'Lee was a chef, baker, restaurateur, and hotelier. His patented designs for a dough-kneading machine and a device that makes breadcrumbs from stale bread have been used in major restaurants around the world.',
      },
    ],
  },
  {
    id: 'ent_judy_w_reed_001',
    displayName: 'Judy W. Reed',
    summary:
      'Judy W. Reed applied in January 1884 for a patent on a dough kneader and roller and received US 305,474 on 23 September 1884. The device fed dough through intermeshed rollers cut with corrugated slats that acted as kneaders, then into a covered receptacle that kept dust and airborne particles off it. The Museum of Food and Drink records her as an illiterate seamstress from Washington, D.C., who signed the 1884 patent document with an X. She is widely called the first African American woman to hold a US patent; because applications did not record race and women often filed under initials, it is not known whether earlier Black women patentees exist. BlackPast dates her birth to about 1826 and states there is no record of her life beyond this document.',
    historicalContext:
      'This record is short because the sources are. BlackPast states plainly that no record of her life survives beyond the patent, and the compilations that produce the ranking never claimed to be a census, so the record says first known rather than first. Washington is the only place any institution attaches to her, and it is attached to her trade as a seamstress rather than to a workshop.',
    city: 'Washington',
    state: 'DC',
    lat: 38.9072,
    lng: -77.0369,
    era: '1880s',
    canonicalUrl: 'https://legacyquiltproject.mofad.org/quilt/judy-w-reed/',
    namedOn: ['inv_reed_dough_kneader_roller'],
    reviewBasis:
      'Deceased historical figure: no institution consulted publishes a death date for Judy W. Reed. BlackPast titles its entry "Judy W. Reed (ca. 1826-?)" and states "There is no record of her life beyond this document." A woman whose birth is dated to about 1826 and who was granted US 305,474 in 1884 cannot be living in 2026; that, and not a death date, is the basis. No living-person privacy interest.',
    evidence: [
      {
        sourceUrl: 'https://www.blackpast.org/african-american-history/reed-judy-w-c-1826/',
        title: 'Judy W. Reed (ca. 1826-?) - BlackPast',
        quote:
          'Little is known about Judy W. Reed, considered to be the first African American woman to receive a United States patent.',
      },
      {
        sourceUrl: 'https://www.blackpast.org/african-american-history/reed-judy-w-c-1826/',
        title: 'Judy W. Reed (ca. 1826-?) - BlackPast',
        quote:
          'On September 23, 1884, Reed received Patent No. 305,474 for her invention. There is no record of her life beyond this document.',
      },
      {
        sourceUrl: 'https://legacyquiltproject.mofad.org/quilt/judy-w-reed/',
        title: 'Museum of Food and Drink, Legacy Quilt: Judy W. Reed',
        quote:
          'An illiterate seamstress from Washington, D.C., Reed signed her 1884 patent document with an "X."',
      },
    ],
  },
  {
    id: 'ent_lyda_d_newman_001',
    displayName: 'Lyda D. Newman',
    summary:
      "Lyda D. Newman was a hairdresser in New York City and a suffrage organizer. The Lemelson-MIT Program states she was born in Ohio between 1865 and 1885 and that census records show she spent most of her life in New York City working as a hairdresser. The USPTO records her as a hair care specialist in the Manhattan neighborhood of San Juan Hill who registered a trademark for a hair and scalp treatment, Vidacabello, in 1894. On 15 November 1898 she received US 614,335 for a brush with fine synthetic bristles and an inner chamber that trapped dust and dirt. In the 1910s she led the Woman Suffrage Party's effort to involve Black women in the struggle for the vote, and she registered to vote on 25 May 1918. Her death date is not recorded.",
    historicalContext:
      'Her birth year is genuinely unsettled: one widely circulated account dates it to 1885, which would make her thirteen at the patent, while the Lemelson-MIT Program gives only a range of 1865 to 1885 and the USPTO documents her running a trademarked hair-care brand in 1894. This record carries the range instead of the story. The grant is an improvement to a hairbrush, not the invention of one, and the suffrage organizing is separate documented work rather than something the patent claims.',
    city: 'New York',
    state: 'NY',
    lat: 40.7128,
    lng: -74.006,
    era: '1890s',
    canonicalUrl: 'https://lemelson.mit.edu/resources/lyda-newman',
    namedOn: ['inv_newman_hairbrush'],
    reviewBasis:
      'Deceased historical figure: no institution consulted publishes a death date for Lyda D. Newman. The Lemelson-MIT Program states she was born in Ohio between 1865 and 1885, and the USPTO records her registering a trademark in 1894 and registering to vote on 25 May 1918. A patentee of 1898 who was an adult voter in 1918 and born no later than 1885 cannot be living in 2026; that, and not a death date, is the basis. No living-person privacy interest.',
    evidence: [
      {
        sourceUrl:
          'https://www.uspto.gov/learning-and-resources/journeys-innovation/suffragist-inventors',
        title: 'USPTO, Seeds of Change: Suffragist Inventors',
        quote:
          'A hair care specialist living in the Manhattan neighborhood of San Juan Hill, Newman made a name for herself with her innovative products.',
      },
      {
        sourceUrl:
          'https://www.uspto.gov/learning-and-resources/journeys-innovation/suffragist-inventors',
        title: 'USPTO, Seeds of Change: Suffragist Inventors',
        quote:
          "Lyda Newman registered to vote on May 25, 1918, just months after a referendum on women's suffrage passed in New York state.",
      },
      {
        sourceUrl: 'https://lemelson.mit.edu/resources/lyda-newman',
        title: 'Lyda Newman - Lemelson-MIT Program',
        quote: 'Lyda Newman was born in Ohio sometime between 1865 and 1885.',
      },
      {
        sourceUrl: 'https://lemelson.mit.edu/resources/lyda-newman',
        title: 'Lyda Newman - Lemelson-MIT Program',
        quote:
          'However, census records show that she spent most of her life living in New York City, working as a hairdresser.',
      },
    ],
  },
  {
    id: 'ent_alexander_miles_001',
    displayName: 'Alexander Miles',
    summary:
      'Alexander Miles (1838-1918) ran a barbershop in a Duluth, Minnesota hotel, used the earnings to buy a real estate office, and became the first Black member of the Duluth Chamber of Commerce. Born in Circleville, Ohio, he had begun inventing earlier as a barber in Wisconsin, where he developed hair care products, and in 1884 he put up a three-story building in Duluth that became known as the Miles Block. On 11 October 1887 he received US 371,207 for an improved method of opening and closing elevator doors: a flexible belt fixed to the elevator cage engaged drums set along the shaft above and below each floor, and levers and rollers worked the doors themselves. In 1899 he moved to Chicago and founded The United Brotherhood, a life insurance company selling to Black Americans refused coverage by white-owned firms.',
    historicalContext:
      "Miles did not invent the elevator and did not originate the automatic elevator door: BlackPast records John W. Meaker's 1874 patent on such a system, and the Miles grant is one belt-and-lever mechanism inside a field that already existed. Duluth is the anchor because that is where the barbershop, the real estate office and the Miles Block are documented, not because a patent lists an address.",
    city: 'Duluth',
    state: 'MN',
    lat: 46.7867,
    lng: -92.1005,
    era: '1880s',
    canonicalUrl: 'https://www.invent.org/inductees/alexander-miles',
    namedOn: ['inv_miles_elevator_door'],
    reviewBasis:
      'Deceased historical figure: Alexander Miles died 7 May 1918. The death date is published by the National Inventors Hall of Fame on his inductee page, which records "Born May 18, 1838 - Died May 7, 1918," and by BlackPast; no living-person privacy interest.',
    evidence: [
      {
        sourceUrl: 'https://www.invent.org/inductees/alexander-miles',
        title: 'Alexander Miles - National Inventors Hall of Fame',
        quote:
          'After moving to Minnesota and opening a highly successful barbershop in the St. Lewis Hotel in Duluth in 1879, Miles used his earnings to buy a real estate office, becoming the first Black member of the Duluth Chamber of Commerce.',
      },
      {
        sourceUrl: 'https://www.invent.org/inductees/alexander-miles',
        title: 'Alexander Miles - National Inventors Hall of Fame',
        quote: 'Born May 18, 1838 - Died May 7, 1918',
      },
      {
        sourceUrl: 'https://www.blackpast.org/african-american-history/miles-alexander-1838-1918/',
        title: 'Alexander Miles (1838-1918) - BlackPast',
        quote:
          "Despite John W. Meaker's patented invention of the first automatic elevator door system (U.S. Patent 147,853) in 1874, many elevators still required the doors and the shaft to be manually opened and closed.",
      },
    ],
  },
  {
    id: 'ent_alfred_l_cralle_001',
    displayName: 'Alfred L. Cralle',
    summary:
      "Alfred L. Cralle, born in 1866 in Kenbridge, Lunenburg County, Virginia, worked in his father's carpentry trade, attended Wayland Seminary in Washington, D.C., and then moved to Pittsburgh, Pennsylvania, where he worked as a porter at a drugstore and at a hotel. That work is where the device came from: he received US 576,395 for an ice cream mold and disher on 2 February 1897. He left the porter jobs at the St. Charles Hotel and the Markell Brothers drugstore to serve as assistant manager of the Afro-American Financial, Accumulating, Merchandise and Business Association, a Pittsburgh company formed by Black investors. Smithsonian Magazine records that the patent never made him much money. Published accounts put his death in 1919 or in 1920 and do not agree.",
    historicalContext:
      'The two institutions that carry his life disagree on the year he died, so this record carries both rather than picking one. The device is routinely called the invention of the ice cream scoop; the grant is a specific one-hand mold and disher, and no source here shows him making money from it. Pittsburgh is the anchor because the hotel and drugstore work, and the business association he went on to help manage, are all documented there.',
    city: 'Pittsburgh',
    state: 'PA',
    lat: 40.4406,
    lng: -79.9959,
    era: '1890s',
    canonicalUrl: 'https://www.blackpast.org/african-american-history/cralle-alfred-l-1866-1920/',
    namedOn: ['inv_cralle_ice_cream_disher'],
    reviewBasis:
      'Deceased historical figure: Alfred L. Cralle died in 1919 or 1920; the two published accounts disagree. Smithsonian Magazine states "Cralle died in 1919"; BlackPast states that later in 1920 he was killed in an automobile accident in Pittsburgh. Both sources date his birth to 1866, and either death year is more than a century past; no living-person privacy interest.',
    evidence: [
      {
        sourceUrl: 'https://www.blackpast.org/african-american-history/cralle-alfred-l-1866-1920/',
        title: 'Alfred L. Cralle (1866-1920) - BlackPast',
        quote:
          'After attending the school for a few years, Cralle moved to Pittsburgh, Pennsylvania, where he worked as a porter at a drugstore and at a hotel.',
      },
      {
        sourceUrl: 'https://www.blackpast.org/african-american-history/cralle-alfred-l-1866-1920/',
        title: 'Alfred L. Cralle (1866-1920) - BlackPast',
        quote:
          'Later in 1920, Cralle himself was killed in an automobile accident in Pittsburgh, Pennsylvania.',
      },
      {
        sourceUrl:
          'https://www.smithsonianmag.com/smart-news/meet-the-black-inventor-who-developed-the-ice-cream-scoop-revolutionizing-a-beloved-frozen-treat-180985886/',
        title: 'Smithsonian Magazine, Meet the Black Inventor Who Developed the Ice Cream Scoop',
        quote:
          'Cralle did receive recognition in the local business community, leaving porter roles at the St. Charles Hotel and the Markell Brothers drugstore to serve as the assistant manager of the Afro-American Financial, Accumulating, Merchandise and Business Association.',
      },
      {
        sourceUrl:
          'https://www.smithsonianmag.com/smart-news/meet-the-black-inventor-who-developed-the-ice-cream-scoop-revolutionizing-a-beloved-frozen-treat-180985886/',
        title: 'Smithsonian Magazine, Meet the Black Inventor Who Developed the Ice Cream Scoop',
        quote: 'Cralle died in 1919.',
      },
    ],
  },
  {
    id: 'ent_andrew_jackson_beard_001',
    displayName: 'Andrew Jackson Beard',
    summary:
      'Andrew Jackson Beard (1849-1921) was a farmer, mill owner and inventor in Jefferson County, Alabama. Born enslaved near Mt. Pinson, he stayed on as a sharecropper after emancipation, bought an eighty-acre farm near Center Point, and then built and operated his own flour mill just outside Birmingham. He patented a plow design in 1881 and a second in 1887, selling the rights to each, and filed a rotary steam engine patent in 1892. After working as a carpenter and a blacksmith he took a job with the Alabama and Chattanooga Railroad, and in September 1897 he patented the car coupling known as the Jenny coupler, US 594,059, selling the rights back to the railroad industry for $50,000. He died in the Jefferson County Alms House on 10 May 1921 and was buried in an unmarked grave.',
    historicalContext:
      "Beard's coupler is usually told as the invention of the automatic railroad coupler; the Encyclopedia of Alabama is explicit that it should not be confused with Eli Janney's coupler, patented in 1873, so this record keeps the grant inside the field it improved. The same source treats the widely repeated story that he lost a leg coupling cars as disputed rather than settled. Birmingham is the anchor because the flour mill and the railroad work are documented there.",
    city: 'Birmingham',
    state: 'AL',
    lat: 33.5186,
    lng: -86.8104,
    era: '1890s',
    canonicalUrl: 'https://www.invent.org/inductees/andrew-j-beard',
    namedOn: ['inv_beard_car_coupling'],
    reviewBasis:
      'Deceased historical figure: Andrew Jackson Beard died 10 May 1921. The Encyclopedia of Alabama records that he died in the Jefferson County Alms House on that date and was buried in an unmarked grave in Woodlawn Cemetery, and the National Inventors Hall of Fame carries the year as 1921; no living-person privacy interest.',
    evidence: [
      {
        sourceUrl: 'https://www.invent.org/inductees/andrew-j-beard',
        title: 'Andrew J. Beard - National Inventors Hall of Fame',
        quote:
          'After relocating to St. Claire County, Alabama, with his family, Beard built and operated his own flour mill just outside Birmingham.',
      },
      {
        sourceUrl: 'https://www.invent.org/inductees/andrew-j-beard',
        title: 'Andrew J. Beard - National Inventors Hall of Fame',
        quote: 'Born 1849 - Died 1921',
      },
      {
        sourceUrl: 'https://encyclopediaofalabama.org/article/andrew-jackson-beard/',
        title: 'Encyclopedia of Alabama, Andrew Jackson Beard',
        quote:
          'Reportedly having become paralyzed and impoverished in his last years, Beard died in the Jefferson County Alms House on May 10, 1921, and was buried in an unmarked grave in Woodlawn Cemetery.',
      },
    ],
  },
  {
    id: 'ent_lonnie_g_johnson_001',
    displayName: 'Lonnie G. Johnson',
    summary:
      "Lonnie G. Johnson is an engineer and entrepreneur whose company is based in Atlanta, Georgia. He attended Tuskegee University, earning a BS in mechanical engineering and an MS in nuclear engineering, and worked as a research engineer at Oak Ridge National Laboratory before joining the US Air Force, where he headed the Space Nuclear Power Safety Section at the Air Force Weapons Laboratory. In 1979 he left the Air Force for NASA's Jet Propulsion Laboratory as a systems engineer on the Galileo mission; returning to the Air Force in 1982, he was the first flight test engineer assigned by Strategic Air Command to the B-2 stealth bomber, and in 1987 he went back to JPL for the Mars Observer and Cassini projects. He received US 4,591,071 for a squirt gun in 1986 and licensed it to Larami Corp as the Super Soaker. He is president and founder of Johnson Research and Development Co. Inc.",
    historicalContext:
      "Johnson is remembered almost entirely through one toy, and that toy is one grant among more than a hundred US patents the National Inventors Hall of Fame credits him with; this record sets the engineering career beside the receipt rather than letting the receipt stand for the man. He is living, so the record carries a city-precision anchor at his company's documented business location and nothing about where or how he lives.",
    city: 'Atlanta',
    state: 'GA',
    lat: 33.749,
    lng: -84.388,
    era: '1980s',
    canonicalUrl: 'https://www.invent.org/inductees/lonnie-johnson',
    namedOn: ['inv_johnson_squirt_gun'],
    livingStatus: 'living',
    reviewBasis:
      'Living public figure: Lonnie G. Johnson is a National Inventors Hall of Fame inductee (2022), founder and president of Johnson Research and Development Co. Inc., and a former US Air Force and NASA Jet Propulsion Laboratory engineer; that professional status is published by the National Inventors Hall of Fame and the Lemelson-MIT Program. The record carries no residence, no birth date, no family detail and no private contact information. The place anchor is Atlanta at city precision, the documented business location of his company, and unknown-or-living persons are capped at city precision under docs/security/location-precision-standard.md.',
    evidence: [
      {
        sourceUrl: 'https://www.invent.org/inductees/lonnie-johnson',
        title: 'Lonnie Johnson - National Inventors Hall of Fame',
        quote:
          'Johnson, who attended Tuskegee University and holds more than 100 U.S. patents, is president and founder of Johnson Research and Development Co. Inc., an Atlanta-based company that has spun off additional companies, including Johnson Energy Storage and JTEC Energy Inc.',
      },
      {
        sourceUrl: 'https://lemelson.mit.edu/resources/lonnie-johnson',
        title: 'Lonnie Johnson - Lemelson-MIT Program',
        quote:
          'He went on to more formal training at Tuskegee University, where he earned a BS in Mechanical Engineering and an MS in Nuclear Engineering.',
      },
    ],
  },
];
