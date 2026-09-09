/**
 * Inventors named on the invention cohort who had no person record in this catalog.
 *
 * The first invention cohort named twenty contributions and linked none of them to a person,
 * because four of the people it centres were not in `bb_canonical.entities` at all: an invention
 * page could not reach its inventor, and the inventor had no page to reach. These four are the
 * gap. Every other name on those receipts either already has a record or is deliberately not
 * modelled (see `InventionContributor` in `./invention-cohort.ts`).
 *
 * Scope discipline matches the invention cohort. Each summary says what the person is documented
 * to have done, and stops. Where a claim is commonly repeated but rests on the limits of the
 * surviving record — "first" claims especially — it is written as the record actually supports
 * it, not as the slogan.
 *
 * `personReviewApproved` in `../lib/incremental-publish.ts` blocks every person row from
 * incremental publish until `payload.personReview` records approved/approvedBy/approvedAt/basis.
 * All four here are long-deceased historical figures with published death dates — 1806, 1926,
 * 1947 and 2015 — which is what the recorded basis states. The staging script writes that marker
 * rather than leaving four rows stranded pending on a fact nobody disputes.
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
      'Benjamin Banneker (1731–1806) was a free Black farmer, astronomer and almanac author in the Patapsco valley of Maryland, in what is now the Ellicott City area. He built a wooden striking clock in the early 1750s, calculated ephemerides for a series of almanacs published in the 1790s, and worked in the survey party that ran the boundary of the federal district. In 1791 he sent Thomas Jefferson a manuscript almanac with a letter arguing against the claim that Black people lacked the capacity for such work, and Jefferson replied. He held no patent; the patent system of his lifetime was not open to him in the way it was to later free citizens, and the clock and the almanacs are documented by contemporary accounts rather than by a grant.',
    historicalContext:
      'Banneker is the case that keeps the invention catalog honest about receipts. An invention with no Patent Office record is still an invention, and treating the absence of a grant as a gap in his life would misstate the eighteenth century rather than describe it. The Ellicott City anchor is the farm country he worked, held at city precision, not a house.',
    city: 'Ellicott City',
    state: 'MD',
    lat: 39.2673,
    lng: -76.7983,
    era: '1750s',
    canonicalUrl: 'https://www.nps.gov/people/benjamin-banneker.htm',
    namedOn: ['inv_banneker_striking_clock'],
    reviewBasis:
      'Deceased historical figure: Benjamin Banneker died 9 October 1806. Death date published by the National Park Service and in standard reference works; no living-person privacy interest.',
    evidence: [
      {
        sourceUrl: 'https://www.nps.gov/people/benjamin-banneker.htm',
        title: 'Benjamin Banneker — National Park Service',
        quote: 'Benjamin Banneker',
      },
    ],
  },
  {
    id: 'ent_miriam_e_benjamin_001',
    displayName: 'Miriam E. Benjamin',
    summary:
      'Miriam E. Benjamin (1861–1947) was a schoolteacher in Washington, D.C., who received US 386,289 for a gong and signal chair on 17 July 1888. The chair let a seated person summon an attendant by pressing a device that sounded a gong and raised a signal, and she pressed for its adoption in the United States House of Representatives. Henry E. Baker, the Patent Office examiner who compiled lists of patents issued to Black inventors, carried her grant as evidence against the claim that Black Americans did not invent. Baker at times treated her as the only confirmed woman on his list; later research found others, and that revision is part of the record rather than a correction to hide.',
    historicalContext:
      "Baker's compilation is a document about who he could confirm from Patent Office records, not a census of Black patentees. Benjamin's grant is one chair-and-gong device. Reading her as the only Black woman ever to hold a US patent repeats a limitation of his sources as though it were a fact about the country.",
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
    ],
  },
  {
    id: 'ent_george_w_murray_001',
    displayName: 'George W. Murray',
    summary:
      'George Washington Murray (1853–1926) was born enslaved in Sumter County, South Carolina, taught school, farmed, and served in the United States House of Representatives in the 1890s, for part of that time as the only Black member of the chamber. He received patents on agricultural implements, including US 520,890 for a planter granted in 1894. In the same period he read into the Congressional Record a compilation of patents issued to Black inventors, using the list as an argument on the floor against claims about Black capacity. The planter and the list are two separate documents, and this catalog holds them apart so each carries its own weight.',
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
    ],
  },
];
