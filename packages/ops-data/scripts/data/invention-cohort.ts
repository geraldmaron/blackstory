/**
 * Cited invention records for the first inventor campaign.
 *
 * Each row is a contribution, not a person and not a patent. Patent numbers and titles
 * are the face of the grant. Language stays inside that scope: an improvement is not
 * origination, and a co-inventor named on the grant stays named. Place is a documented
 * work site at city precision, never a filing address treated as the workshop.
 */
export type InventionCohortRecord = {
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
  readonly patentNumber?: string;
  readonly evidence: readonly {
    readonly sourceUrl: string;
    readonly title: string;
    readonly quote: string;
  }[];
};

export const INVENTION_COHORT: readonly InventionCohortRecord[] = [
  {
    id: 'inv_latimer_carbon_process',
    displayName: 'Process of Manufacturing Carbons',
    summary:
      'US 252,386, titled "Process of Manufacturing Carbons," names Lewis H. Latimer and was granted on 17 January 1882. The specification describes a method for producing carbon conductors used in incandescent lamps. It does not claim, and this record does not claim, that Latimer invented the incandescent lamp. The work sits with his employment at the United States Electric Lighting Company in New York, not with an address printed so a patent could be filed.',
    historicalContext:
      'The grant is a receipt for a manufacturing process. Treating it as the invention of the light bulb widens a process patent into a category Latimer did not claim. Hiram Maxim employed him at the United States Electric Lighting Company; that shop is the place this record uses.',
    city: 'New York',
    state: 'NY',
    lat: 40.7128,
    lng: -74.006,
    era: '1880s',
    canonicalUrl: 'https://patents.google.com/patent/US252386A',
    patentNumber: '252386',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US252386A',
        title: 'US 252,386',
        quote: 'Process of Manufacturing Carbons',
      },
    ],
  },
  {
    id: 'inv_morgan_traffic_signal',
    displayName: 'Three-Position Traffic Signal',
    summary:
      'US 1,475,024, titled "Traffic signal," names Garrett A. Morgan and was granted on 20 November 1923. The specification describes a hand-operated signal with a third position, beyond stop and go. It does not establish that Morgan invented traffic control, or that every later signal descends from this grant. The record is the three-position device he patented, associated with his work in Cleveland. A second Morgan grant, the safety hood, is a different record.',
    historicalContext:
      'A broad claim that Morgan invented the traffic light collapses a specific three-position mechanism into a category. The patent names the device. Cleveland is the city the historical account ties to the work, held here at city precision.',
    city: 'Cleveland',
    state: 'OH',
    lat: 41.4993,
    lng: -81.6944,
    era: '1920s',
    canonicalUrl: 'https://patents.google.com/patent/US1475024A',
    patentNumber: '1475024',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US1475024A',
        title: 'US 1,475,024',
        quote: 'Traffic signal',
      },
    ],
  },
  {
    id: 'inv_morgan_safety_hood',
    displayName: 'Safety Hood',
    summary:
      'US 1,090,936, titled "Breathing device," names Garrett A. Morgan and was granted on 20 October 1914. The specification describes a hood that supplies air to the wearer in smoke. It is a breathing device, not a later self-contained gas mask, and it is not the traffic signal patented nine years later. Those are two grants. This record is the hood, associated with Morgan\'s work in Cleveland. The traffic signal is held separately so the two documents stay distinct.',
    historicalContext:
      'The safety hood and the traffic signal are separate contributions. Folding both into "Garrett Morgan invented safety equipment" erases the document each grant actually is. The hood is held here on its own.',
    city: 'Cleveland',
    state: 'OH',
    lat: 41.4993,
    lng: -81.6944,
    era: '1910s',
    canonicalUrl: 'https://patents.google.com/patent/US1090936A',
    patentNumber: '1090936',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US1090936A',
        title: 'US 1,090,936',
        quote: 'Breathing device',
      },
    ],
  },
  {
    id: 'inv_west_sessler_electret_microphone',
    displayName: 'Electret Microphone',
    summary:
      'US 3,118,022, titled "Electroacoustic transducer," names James E. West and Gerhard M. Sessler and was granted on 14 January 1964. The specification describes an electret microphone. West did not invent it alone: the grant names two inventors, and dropping Sessler would make the document false. The work is associated with Bell Telephone Laboratories in Murray Hill, New Jersey. Sessler is not modeled as a separate catalog person; he is still named on this receipt.',
    historicalContext:
      'Centering West is an editorial choice about who this archive exists to cover. It is not a license to erase the co-inventor the patent prints. Sessler remains named. The pin is the laboratory city, not a filing address.',
    city: 'Murray Hill',
    state: 'NJ',
    lat: 40.6954,
    lng: -74.401,
    era: '1960s',
    canonicalUrl: 'https://patents.google.com/patent/US3118022A',
    patentNumber: '3118022',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US3118022A',
        title: 'US 3,118,022',
        quote: 'Electroacoustic transducer',
      },
    ],
  },
  {
    id: 'inv_sampson_miley_gamma_cell',
    displayName: 'Gamma-Electric Cell',
    summary:
      'US 3,591,860, titled "Gamma-electric cell," names Henry T. Sampson and George H. Miley and was granted on 6 July 1971. The specification describes a cell that converts gamma radiation into electricity. It is not a cellular telephone, and nothing on the grant supports that story. The grant names two inventors. This record keeps both, and describes only the cell. Miley stays on the receipt even though this archive does not open a separate person record for him.',
    historicalContext:
      'The cellular-phone attribution is a later internet myth. The patent is a radiation cell with two named inventors. A filing address is not used as the workshop; the pin is city-level and is not offered as the laboratory bench.',
    city: 'Urbana',
    state: 'IL',
    lat: 40.1106,
    lng: -88.2073,
    era: '1970s',
    canonicalUrl: 'https://patents.google.com/patent/US3591860A',
    patentNumber: '3591860',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US3591860A',
        title: 'US 3,591,860',
        quote: 'Gamma-electric cell',
      },
    ],
  },
  {
    id: 'inv_boone_ironing_board',
    displayName: 'Ironing-Board Improvement',
    summary:
      'US 473,653, titled "Ironing-board," names Sarah Boone and was granted on 26 April 1892. The title is an improvement, and the specification describes a board shaped for sleeves. It does not say Boone invented ironing, or the first ironing board. The grant is the receipt for that improvement, associated with her work in New Haven, Connecticut. The word improvement on the face of the patent is the bound this record keeps.',
    historicalContext:
      'Reading "improvement" as "invented the category" is the mistake this record exists to refuse. The patent prints the narrower claim. New Haven is the city tied to the work, not a sharper address than the evidence supports.',
    city: 'New Haven',
    state: 'CT',
    lat: 41.3083,
    lng: -72.9279,
    era: '1890s',
    canonicalUrl: 'https://patents.google.com/patent/US473653A',
    patentNumber: '473653',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US473653A',
        title: 'US 473,653',
        quote: 'Ironing-board',
      },
    ],
  },
  {
    id: 'inv_benjamin_gong_signal_chair',
    displayName: 'Gong and Signal Chair',
    summary:
      'US 386,289, titled "Gong and signal chair," names Miriam E. Benjamin and was granted on 17 July 1888. The specification describes a chair with a gong so a seated person could signal an attendant. Henry E. Baker at times treated her as the only confirmed woman on his list of Black patentees; later research found others. That change in the list is part of the record. The work is associated with Washington, D.C.',
    historicalContext:
      "Baker's list is a historical document about who he could confirm, not a complete census. This grant is one chair-and-gong device. It is not a claim that Benjamin was the only Black woman to receive a US patent.",
    city: 'Washington',
    state: 'DC',
    lat: 38.9072,
    lng: -77.0369,
    era: '1880s',
    canonicalUrl: 'https://patents.google.com/patent/US386289A',
    patentNumber: '386289',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US386289A',
        title: 'US 386,289',
        quote: 'Gong and signal chair',
      },
    ],
  },
  {
    id: 'inv_carver_crop_product_processes',
    displayName: 'Tuskegee Crop-Product Processes',
    summary:
      'George Washington Carver received three US patents: US 1,522,176 for a cosmetic, US 1,541,478 for paints and stains from clay and other products, and US 1,632,365 for a paint and stain process. Those grants are specific processes. They are not "peanut butter," and they are not the whole of his work. The agricultural bulletins he wrote at Tuskegee Institute document crop uses beyond the patent count. This record is those processes, held at Tuskegee, Alabama.',
    historicalContext:
      'Counting patents understates Carver and inflating them invents a sole inventor of peanut products. The public claim stays inside the three grants and the Tuskegee bulletins. Tuskegee Institute is the institutional site the work is tied to.',
    city: 'Tuskegee',
    state: 'AL',
    lat: 32.424,
    lng: -85.691,
    era: '1920s',
    canonicalUrl: 'https://patents.google.com/patent/US1522176A',
    patentNumber: '1522176',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US1522176A',
        title: 'US 1,522,176',
        quote: 'Cosmetic and process of producing the same',
      },
      {
        sourceUrl: 'https://patents.google.com/patent/US1541478A',
        title: 'US 1,541,478',
        quote: 'Paint and stain and process of producing the same',
      },
    ],
  },
  {
    id: 'inv_banneker_striking_clock',
    displayName: 'Striking Clock',
    summary:
      'Benjamin Banneker built a wooden striking clock in the early 1750s on his farm in what is now the Ellicott City area of Maryland. No patent records it. A patent was not available to him in the way it was to later free citizens, and this invention does not need one to be an invention. The clock is known from contemporary accounts of the instrument he made, not from a grant. The pin is the city, not a house.',
    historicalContext:
      'Using the absence of a patent as a gap to fill would misstate the 18th century. The clock is the case that an invention record can exist without a Patent Office receipt. Ellicott City is a city-level anchor for the farm country where he worked, not a street address.',
    city: 'Ellicott City',
    state: 'MD',
    lat: 39.2673,
    lng: -76.7983,
    era: '1750s',
    canonicalUrl: 'https://www.nps.gov/people/benjamin-banneker.htm',
    evidence: [
      {
        sourceUrl: 'https://www.loc.gov/item/today-in-history/november-09/',
        title: 'Library of Congress, Benjamin Banneker',
        quote: 'Benjamin Banneker',
      },
    ],
  },
  {
    id: 'inv_joyner_permanent_wave_machine',
    displayName: 'Permanent-Waving Machine',
    summary:
      "US 1,693,515, titled \"Permanent wave machine,\" names Marjorie S. Joyner and was granted on 27 November 1928. The grant was assigned to the Madame C. J. Walker Manufacturing Company. Assignment means the company held the patent; it does not make the machine Walker's invention, and it does not fold Joyner's work into Walker's biography. The specification describes a machine for waving hair. The work is associated with the Walker company's Chicago operation.",
    historicalContext:
      'Company assignment is a fact about ownership of the grant, not about who designed the machine. The patent prints Joyner as inventor and Walker Manufacturing as assignee. Both facts stay. Chicago is the city tied to that work.',
    city: 'Chicago',
    state: 'IL',
    lat: 41.8781,
    lng: -87.6298,
    era: '1920s',
    canonicalUrl: 'https://patents.google.com/patent/US1693515A',
    patentNumber: '1693515',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US1693515A',
        title: 'US 1,693,515',
        quote: 'Permanent wave machine',
      },
    ],
  },
  {
    id: 'inv_murray_planter',
    displayName: 'Planter',
    summary:
      'US 520,890 names George W. Murray and is a planter, granted in 1894. Murray was also a member of Congress from South Carolina, and in 1894 he presented a compilation of inventions patented by Black inventors. Those are two different facts: the planter is one grant, and the list he carried to Congress is documentation, not this machine. The pin is Sumter, South Carolina, the county seat of the farming district the historical account ties to his work, at city precision.',
    historicalContext:
      'The planter is not the 92-invention list, and the list is not the planter. Keeping them apart is the point. A filing address is not used as the field where the machine was meant to work.',
    city: 'Sumter',
    state: 'SC',
    lat: 33.9204,
    lng: -80.3415,
    era: '1890s',
    canonicalUrl: 'https://patents.google.com/patent/US520890A',
    patentNumber: '520890',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US520890A',
        title: 'US 520,890',
        quote: 'Planter',
      },
    ],
  },
  {
    id: 'inv_jennings_dry_scouring',
    displayName: 'Dry-Scouring Process',
    summary:
      'Thomas L. Jennings received a US patent in 1821 for a dry-scouring process, often cited as the earliest known US patent to a Black inventor. Early Patent Office records were destroyed in the 1836 fire, so the surviving evidence is institutional history rather than a face of the grant that can still be opened. This record says first known, not first. The work is associated with New York. The missing specification is a fact about the archive, not a hole to invent.',
    historicalContext:
      'Absolute firstness cannot be read from a destroyed series. "First known" is the claim the evidence supports. New York is the city tied to Jennings\'s work, not a reconstructed shop address.',
    city: 'New York',
    state: 'NY',
    lat: 40.7128,
    lng: -74.006,
    era: '1820s',
    canonicalUrl: 'https://www.loc.gov/item/today-in-history/march-03/',
    evidence: [
      {
        sourceUrl: 'https://www.uspto.gov/learning-and-resources/ip-policy/historical-patents',
        title: 'USPTO historical patents',
        quote: 'Thomas L. Jennings',
      },
    ],
  },
  {
    id: 'inv_jones_numero_air_cooling',
    displayName: 'Portable Air-Cooling Unit',
    summary:
      "US 2,303,857 names Joseph A. Numero and Frederick M. Jones for an air conditioning unit, granted in 1942. The grant names both men. Jones's refrigeration work for truck transport is a portfolio, not this one document, and Thermo King is the company that commercialized the line. This record is the portable cooling unit the patent describes. It does not say Jones invented refrigeration. Minneapolis is the city tied to that work.",
    historicalContext:
      'Numero remains on the grant. Centering Jones does not delete the co-inventor the document prints. The unit is one receipt in a larger body of work, not a synonym for the whole portfolio.',
    city: 'Minneapolis',
    state: 'MN',
    lat: 44.9778,
    lng: -93.265,
    era: '1940s',
    canonicalUrl: 'https://patents.google.com/patent/US2303857A',
    patentNumber: '2303857',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US2303857A',
        title: 'US 2,303,857',
        quote: 'Air conditioning unit',
      },
    ],
  },
  {
    id: 'inv_brown_home_security',
    displayName: 'Home Security System',
    summary:
      'US 3,482,037, titled "Home security system utilizing television surveillance," names Marie Van Brittan Brown and Albert L. Brown and was granted on 2 December 1969. The specification describes a system of peepholes, a camera, and a monitor. Both inventors are named on the grant. Dropping Albert L. Brown would misstate the document. The work is associated with Queens, New York, at city precision. The record may center Marie and still has to keep Albert on the receipt.',
    historicalContext:
      'This is a co-invention test the grant itself settles: two names appear. The record may center Marie Van Brittan Brown and still has to keep Albert on the receipt. Queens is the city, not a residential street.',
    city: 'Queens',
    state: 'NY',
    lat: 40.7282,
    lng: -73.7949,
    era: '1960s',
    canonicalUrl: 'https://patents.google.com/patent/US3482037A',
    patentNumber: '3482037',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US3482037A',
        title: 'US 3,482,037',
        quote: 'Home security system utilizing television surveillance',
      },
    ],
  },
  {
    id: 'inv_bath_laserphaco',
    displayName: 'Laserphaco Probe',
    summary:
      'US 4,744,360, titled "Apparatus for ablating and removing cataract lenses," names Patricia E. Bath and was granted on 17 May 1988. The device is known as the Laserphaco probe. The grant covers an apparatus for removing cataract lenses. It does not say Bath invented laser surgery, or ophthalmology. The work is associated with Los Angeles, where she practiced and developed the apparatus. Laserphaco is the name of this probe, not a claim about every laser used in medicine.',
    historicalContext:
      'The public name Laserphaco is a label for this apparatus, not a wider claim about lasers in medicine. The patent title is the bound. Los Angeles is the city tied to the development, not a clinic street address.',
    city: 'Los Angeles',
    state: 'CA',
    lat: 34.0522,
    lng: -118.2437,
    era: '1980s',
    canonicalUrl: 'https://patents.google.com/patent/US4744360A',
    patentNumber: '4744360',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US4744360A',
        title: 'US 4,744,360',
        quote: 'Apparatus for ablating and removing cataract lenses',
      },
    ],
  },
  {
    id: 'inv_goode_cabinet_bed',
    displayName: 'Cabinet Bed',
    summary:
      'US 322,177, titled "Cabinet-bed," names Sarah E. Goode and was granted on 14 July 1885. The specification describes a folding bed that could be used as a desk. It is that cabinet-bed, not the invention of furniture, and not a claim that Goode was the first Black woman to receive any US patent without the surviving-record qualification historians actually use. The work is associated with Chicago. The document proves the folding bed, not a ranking of patentees.',
    historicalContext:
      'The grant is a specific folding bed. Superlatives about firstness need the destroyed-record caution used for earlier patentees, and they are not what this document proves. Chicago is the city tied to the work.',
    city: 'Chicago',
    state: 'IL',
    lat: 41.8781,
    lng: -87.6298,
    era: '1880s',
    canonicalUrl: 'https://patents.google.com/patent/US322177A',
    patentNumber: '322177',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US322177A',
        title: 'US 322,177',
        quote: 'Cabinet-bed',
      },
    ],
  },
  {
    id: 'inv_rillieux_evaporator',
    displayName: 'Multiple-Effect Evaporator',
    summary:
      'Norbert Rillieux patented a multiple-effect vacuum evaporator for refining sugar, US 4,879, granted in 1846, titled as an improvement in sugar-works. The apparatus evaporates sugarcane juice in stages under vacuum. It is that refining apparatus, not the invention of sugar, and not every later evaporator. Rillieux developed the work in connection with Louisiana sugar production. The pin is New Orleans, at city precision.',
    historicalContext:
      'The 1840s grant is a process apparatus for sugar refining. Later improvements by other people are not this patent. New Orleans is the city the historical account ties to the sugar work, not a plantation house treated as the invention site.',
    city: 'New Orleans',
    state: 'LA',
    lat: 29.9511,
    lng: -90.0715,
    era: '1840s',
    canonicalUrl: 'https://patents.google.com/patent/US4879A',
    patentNumber: '4879',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US4879A',
        title: 'US 4,879',
        quote: 'Improvement in sugar-works',
      },
    ],
  },
  {
    id: 'inv_carruthers_far_uv_camera',
    displayName: 'Far-Ultraviolet Electrographic Camera',
    summary:
      "George R. Carruthers designed a far-ultraviolet electrographic camera used on Apollo 16 in 1972, developed at the Naval Research Laboratory in Washington, D.C. NASA technical reports are the near-primary record of the instrument. This is that camera and the images it made from the Moon, not a claim that Carruthers invented spaceflight or ultraviolet astronomy. The pin is the laboratory's city, not a street address on a NASA campus.",
    historicalContext:
      'The Naval Research Laboratory is the institutional site of the work. A patent, where one exists, is a receipt for a narrower claim and is not required for this instrument to be an invention. Washington is city precision for the laboratory, not a street address.',
    city: 'Washington',
    state: 'DC',
    lat: 38.9072,
    lng: -77.0369,
    era: '1970s',
    canonicalUrl: 'https://www.nasa.gov/people/george-carruthers/',
    evidence: [
      {
        sourceUrl: 'https://ntrs.nasa.gov/citations/19730017596',
        title: 'NASA NTRS, Apollo 16 far-ultraviolet camera',
        quote: 'far-ultraviolet',
      },
    ],
  },
  {
    id: 'inv_dean_isa_bus_controller',
    displayName: 'Microcomputer Bus Controller',
    summary:
      'US 4,528,626 names Mark E. Dean among the inventors of a microcomputer system with bus control, granted in 1985, from work at IBM in Boca Raton, Florida. The grant is a bus-control apparatus. It is not the invention of the personal computer. Other names on the grant stay on the grant. This record is that controller, not a biography of every IBM machine Dean touched. The face of the patent is the bound, not the later slogan.',
    historicalContext:
      'A bus patent is easy to inflate into "invented the PC." The document is narrower, and the co-inventors it names are part of the receipt. Boca Raton is the city tied to the IBM work, at city precision.',
    city: 'Boca Raton',
    state: 'FL',
    lat: 26.3683,
    lng: -80.1289,
    era: '1980s',
    canonicalUrl: 'https://patents.google.com/patent/US4528626A',
    patentNumber: '4528626',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US4528626A',
        title: 'US 4,528,626',
        quote: 'Microcomputer system with bus control',
      },
    ],
  },
  {
    id: 'inv_croak_voip_packet',
    displayName: 'Voice-over-Packet Method',
    summary:
      'Marian R. Croak is named on patents for transmitting voice over a packet network, including US 7,599,359, from work at AT&T in Murray Hill, New Jersey. Those grants cover specific methods for carrying voice on a packet network. They do not say she invented the internet, or the telephone. This record is that voice-over-packet method, not a category. Other inventors named on a given grant remain part of that receipt.',
    historicalContext:
      'VoIP is a field. A patent is a method inside it. The public wording stays with the method the grant describes. Murray Hill is the laboratory city, not a filing address treated as the workshop.',
    city: 'Murray Hill',
    state: 'NJ',
    lat: 40.6954,
    lng: -74.401,
    era: '2000s',
    canonicalUrl: 'https://patents.google.com/patent/US7599359B2',
    patentNumber: '7599359',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US7599359B2',
        title: 'US 7,599,359',
        quote: 'Method and apparatus for monitoring the quality of VoIP calls',
      },
    ],
  },
];
