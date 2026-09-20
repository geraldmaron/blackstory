/** Inspected primary material. Research decisions: docs/research/lives-archive-reading.md. */
import type { DestinationIconId } from '@repo/public-contracts/destinations';
import type { LivesMilestoneKey } from './lives-milestones';

export type LivesArchiveReading = {
  readonly date: string;
  readonly place: string;
  readonly title: string;
  readonly image: { readonly url: string; readonly alt: string; readonly credit: string };
  readonly source: { readonly label: string; readonly url: string };
  readonly caption: string;
  readonly rights: string;
  readonly paragraphs: readonly string[];
  readonly transcription: string;
  readonly notice: string;
  readonly question: string;
  readonly companion?: {
    readonly title: string;
    readonly date: string;
    readonly body: string;
    readonly quote?: string;
    readonly scope: string;
    readonly source: { readonly label: string; readonly url: string };
  };
  readonly connections: readonly {
    readonly title: string;
    readonly line: string;
    readonly href: string;
    readonly icon: DestinationIconId;
  }[];
};

const duBois = {
  title: 'W. E. B. Du Bois',
  line: 'The scholar behind the exhibit. Open the person record.',
  href: '/entity/ent_web_du_bois_001',
  icon: 'person',
} as const;
const LOC_RIGHTS = 'Library of Congress: no known restrictions on publication.';
const schoolAndWork = {
  title: 'A school could open and still be out of reach',
  date: 'Childhood after emancipation · Malden, West Virginia · Recalled in 1901',
  quote: 'Often I began work as early as four o’clock in the morning.',
  body: 'Booker T. Washington remembered working in a salt furnace as a child. His stepfather initially kept him at work when a local school opened. Washington arranged lessons at night, then gained permission to attend by working before and after school. He also described families paying a teacher and taking turns providing meals. The account connects a child’s schooling to household income, adult decisions, and a community’s own institution-building.',
  scope:
    'Washington’s retrospective autobiography, not a representative childhood or the experience of the Tuskegee students in Johnston’s photograph. The short quotation modernizes only the apostrophe.',
  source: {
    label:
      'Booker T. Washington, Up from Slavery (1901), chapter II, pp. 26–32. UNC, Documenting the American South',
    url: 'https://docsouth.unc.edu/fpn/washington/washing.html',
  },
} as const;
const nicodemus = {
  title: 'Staying meant building a community',
  date: '1877–1887 · Nicodemus, Kansas',
  body: 'Settlers from Kentucky began arriving in Nicodemus in 1877. By 1887 the town had stores, a bank, a law firm, a post office, and other businesses. Farming families relied on a town that also served as a social and cultural center. The National Park Service links the railroads’ bypassing the town to lost jobs and population decline. Its annual Homecoming grew out of an Emancipation Celebration begun in 1878: a connection to place that outlasted many residents’ departure.',
  scope:
    'A documented Kansas example of settlement, local employment, and continuing community. It isn’t an explanation of the national urban share or a description of every Black farming family.',
  source: {
    label: 'National Park Service, Nicodemus National Historic Site, cultural landscape history',
    url: 'https://www.nps.gov/articles/nicodemus_nhs_landscape_equality.htm',
  },
} as const;
const cityReading: LivesArchiveReading = {
  date: '1890 / c. 1900',
  place: 'Georgia → Paris',
  title: 'A world outside the city',
  image: {
    url: 'https://tile.loc.gov/storage-services/service/pnp/ppmsca/33800/33873v.jpg',
    alt: 'Du Bois’s hand-drawn chart: a long red line coils into a spiral for Black Georgians living in the country and villages; much shorter lines represent three sizes of city.',
    credit: 'W. E. B. Du Bois, c. 1900. Library of Congress, item 2013650430.',
  },
  source: {
    label: 'City and rural population. 1890. Original item and catalog record',
    url: 'https://www.loc.gov/item/2013650430/',
  },
  caption:
    'Made for the 1900 Paris Exposition, this chart describes Black Georgians in 1890. The year of the evidence isn’t the year of the exhibition.',
  rights: LOC_RIGHTS,
  paragraphs: [
    'The rural population takes up the page. W. E. B. Du Bois gives it a line so long that it has to curl back on itself. It’s a different way of making a population visible.',
    'The Library of Congress identifies the chart as part of Du Bois’s exhibit on African American economic and social progress since emancipation. It is an argument addressed to an international audience, made by a Black scholar, rather than a neutral window into every household.',
  ],
  transcription:
    'Chart labels: 78,139 in cities of over 10,000 inhabitants; 8,025 in cities from 5,000 to 10,000; 37,699 in cities from 2,500 to 5,000; 734,952 living in the country and villages. The original uses the historical term “Negroes.” These are the exhibit’s printed figures, not a new national estimate.',
  notice:
    'Georgia only. Rural residence doesn’t tell us whether a person owned land, rented it, farmed it, or worked for wages.',
  question:
    'What changes when rural life occupies most of the image, rather than being the remainder after a city statistic?',
  connections: [
    duBois,
    {
      title: 'Nicodemus, Kansas',
      line: 'A different rural history: Black settlement and community institutions.',
      href: '/place/nicodemus',
      icon: 'place',
    },
  ],
};

export const LIVES_ARCHIVE_READINGS: Readonly<Record<LivesMilestoneKey, LivesArchiveReading>> = {
  place: { ...cityReading, companion: nicodemus },
  home: {
    date: 'c. 1900',
    place: 'Georgia → Paris',
    title: 'Land was something to hold on to',
    image: {
      url: 'https://tile.loc.gov/storage-services/service/pnp/ppmsca/33800/33880v.jpg',
      alt: 'Hand-lettered Du Bois exhibit titled “Value of land owned by Georgia Negroes,” with six illustrated money bags increasing in size from 1875 to 1899.',
      credit: 'W. E. B. Du Bois, c. 1900. Library of Congress, item 2013650437.',
    },
    source: {
      label: 'Value of land owned by Georgia Negroes. Original item and catalog record',
      url: 'https://www.loc.gov/item/2013650437/',
    },
    caption:
      'An original hand-drawn exhibit on the value of Black-owned land in Georgia, prepared for the 1900 Paris Exposition.',
    rights: LOC_RIGHTS,
    paragraphs: [
      'W. E. B. Du Bois chose land ownership as one way to show economic life after emancipation. The historical object keeps the act of making that case visible: lettering, color, and the decision to compare years on one sheet.',
      'The value of land and the share of households owning a home answer different questions. A total value can grow while ownership remains uneven. Neither measure, on its own, tells us about a tenant’s rent, an owner’s debt, or who could inherit the property.',
    ],
    transcription:
      'The heading reads “Value of land owned by Georgia Negroes.” Labels on the six money bags: 1875, $1,263,902; 1880, $1,522,173; 1885, $2,362,889; 1890, $3,425,176; 1895, $4,158,960; 1899, $4,220,120. These are the exhibit’s historical dollar figures, not inflation-adjusted values or household ownership rates.',
    notice:
      'A Georgia exhibit, not a national household survey. Historical wording is retained only when identifying the source.',
    question:
      'What would you need to know about debt, inheritance, and tenants before calling a rise in land value greater security?',
    connections: [
      duBois,
      {
        title: 'Buying a Home',
        line: 'Continue into the chapter on housing rules, credit, and ownership.',
        href: '/stories/buying-a-home',
        icon: 'stories',
      },
    ],
    companion: nicodemus,
  },
  school: {
    date: '1902',
    place: 'Tuskegee, Alabama',
    title: 'Inside a history classroom',
    image: {
      url: 'https://tile.loc.gov/storage-services/service/pnp/cph/3b10000/3b12000/3b12300/3b12301r.jpg',
      alt: 'Students and an instructor in a history classroom at Tuskegee Institute, photographed by Frances Benjamin Johnston in 1902.',
      credit: 'Frances Benjamin Johnston, 1902. Library of Congress, item 98503043.',
    },
    source: {
      label: 'History class, Tuskegee Institute. Original photograph and catalog record',
      url: 'https://www.loc.gov/pictures/item/98503043/',
    },
    caption:
      'History students at Tuskegee Institute, Alabama. The catalog identifies the class and institution, but doesn’t name the individual students.',
    rights: LOC_RIGHTS,
    paragraphs: [
      'A school-attendance table compresses many classrooms into one figure. Johnston’s photograph gives one class a setting and a subject: these students were studying history at Tuskegee in 1902.',
      'The camera records the people present. It can’t show the children who never enrolled, the cost of getting to school, or how long each pupil stayed. Nor is an institute classroom a stand-in for every rural elementary school. Those distinctions matter when setting it beside age-specific attendance figures.',
    ],
    transcription:
      'Catalog title: “[History class, Tuskegee Institute, Tuskegee, Alabama].” Date: 1902. Photographer: Frances Benjamin Johnston. The item contains no individual student names or first-person testimony.',
    notice:
      'One institutional photograph. It doesn’t establish a typical classroom, a pupil’s income, or what any student was thinking.',
    question:
      'What can you learn from who is in the room, and what questions can this photograph never answer?',
    connections: [
      {
        title: 'Tuskegee University',
        line: 'Follow the institution’s place record and sources.',
        href: '/place/tuskegee-university',
        icon: 'school',
      },
      {
        title: 'Finishing school',
        line: 'Follow the next life question: attendance isn’t the same as a diploma.',
        href: '/lives?milestone=education',
        icon: 'publication',
      },
    ],
    companion: schoolAndWork,
  },
  education: {
    date: '17 May 1954',
    place: 'United States Supreme Court',
    title: 'A right written into the record',
    image: {
      url: 'https://www.archives.gov/files/milestone-documents/images/doc-087-big.jpg',
      alt: 'First page of the Supreme Court’s Brown v. Board of Education opinion, decided May 17, 1954.',
      credit: 'Supreme Court of the United States, 1954. National Archives, Record Group 267.',
    },
    source: {
      label: 'Brown v. Board of Education: original opinion, transcript, and historical context',
      url: 'https://www.archives.gov/milestone-documents/brown-v-board-of-education',
    },
    caption:
      'The opening page of the 1954 opinion. Read the full transcript for the Court’s reasoning and the cases joined in the decision.',
    rights: 'U.S. federal government judicial opinion. Reproduction: National Archives.',
    paragraphs: [
      'Brown concerned children denied admission to public schools on a nonsegregated basis. The Court held that state-imposed school segregation violated equal protection, even where physical facilities and other tangible factors might be equal.',
      'The decision didn’t instantly produce integrated schools. The National Archives account describes the further implementation ruling in 1955 and resistance to desegregation. Adult completion rates also include people whose schooling happened decades earlier. A law’s date and a later census figure aren’t a before-and-after experiment.',
    ],
    transcription:
      'Excerpt from the opinion: “Separate educational facilities are inherently unequal.” The full opinion and an accessible transcript are available at the National Archives source link.',
    notice:
      'The legal holding establishes a rule, not the pace of compliance or a numerical effect on graduation.',
    question:
      'When a right changes, whose school years have already passed, and whose are still ahead?',
    connections: [
      {
        title: 'School desegregation records',
        line: 'Find the documented cases, schools, and places behind the legal change.',
        href: '/records?q=school%20desegregation',
        icon: 'records',
      },
      {
        title: 'Law',
        line: 'Follow statutes and decisions beyond one opinion.',
        href: '/law',
        icon: 'law',
      },
    ],
  },
  work: {
    date: '25 June 1941',
    place: 'Washington, D.C. · Defense industries',
    title: 'When a job opening wasn’t an open door',
    image: {
      url: 'https://www.archives.gov/files/doc-072-big.jpg',
      alt: 'Executive Order 8802, dated June 25, 1941, addressing discrimination in defense employment.',
      credit: 'Franklin D. Roosevelt, 1941. National Archives, Record Group 11.',
    },
    source: {
      label: 'Executive Order 8802: original order, transcript, and historical context',
      url: 'https://www.archives.gov/milestone-documents/executive-order-8802',
    },
    caption:
      'The original order addresses hiring, vocational training, federal defense contracts, and a committee to investigate discrimination complaints.',
    rights: 'U.S. federal government executive order. Reproduction: National Archives.',
    paragraphs: [
      'The order itself records that available workers had been barred from defense production because of race, creed, color, or national origin. Labor demand alone didn’t give every applicant access to those jobs.',
      'The National Archives describes A. Philip Randolph’s threatened march on Washington as pressure behind Roosevelt’s action. The order required nondiscrimination clauses in new defense contracts and established a committee to investigate complaints. That is a documented mechanism of exclusion and a policy response, not a complete explanation of national unemployment.',
    ],
    transcription:
      'Excerpt from the order: “available and needed workers have been barred from employment in industries engaged in defense production solely because of considerations of race, creed, color, or national origin.” Read the three numbered provisions in the linked transcript.',
    notice:
      'Defense employment and government, 1941. This order doesn’t prove enforcement, eliminate other causes of joblessness, or explain later decades.',
    question:
      'If work exists but an employer can refuse you, what does an unemployment rate leave out?',
    connections: [
      {
        title: 'The March on Washington Movement of 1941',
        line: 'Open the record for the campaign behind the order.',
        href: '/place/march-on-washington-movement-of-1941',
        icon: 'movement',
      },
      {
        title: 'The Gap That Never Closed',
        line: 'Continue into the chapter on wealth and economic inequality.',
        href: '/stories/the-gap-that-never-closed',
        icon: 'stories',
      },
    ],
    companion: {
      ...schoolAndWork,
      scope:
        'Washington’s retrospective autobiography about childhood work. It isn’t evidence about defense employment in 1941 or a population-wide unemployment measure.',
    },
  },
  count: {
    ...cityReading,
    title: 'Who gets to make the picture?',
    paragraphs: [
      'The census classifies people. Here, W. E. B. Du Bois uses population figures to make his own argument about Black life. The Library of Congress identifies this hand-drawn chart as part of the exhibit he prepared for the 1900 Paris Exposition.',
      'The choice of scale changes what a viewer notices. A rural population can become a small remainder in a sentence about cities, or the largest visual presence on a page. Being counted and controlling the story of that count are different things.',
    ],
    connections: [
      duBois,
      {
        title: 'The Count',
        line: 'Read the chapter on census categories and the power to classify.',
        href: '/stories/the-count',
        icon: 'stories',
      },
    ],
  },
};
