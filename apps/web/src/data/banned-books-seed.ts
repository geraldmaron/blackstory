/**
 * Curated seed catalog of Black-history-relevant challenged titles for the public `/books`
 * surface. Each record is validated at module load via `assertBannedBookRecord`.
 */
import { createHash } from 'node:crypto';
import {
  assertBannedBookRecord,
  buildIsbnPurchaseLinks,
  type BannedBookCitation,
  type BannedBookRecord,
  type BannedBooksListingSnapshot,
} from '@repo/domain';
import { BOOKSHOP_AFFILIATE_ID } from '@repo/config/identity';

export const BANNED_BOOKS_SEED_VERSION = '2026-07-28.1';

function seedPurchaseLinks(isbn13: string) {
  return buildIsbnPurchaseLinks(isbn13, { bookshopAffiliateId: BOOKSHOP_AFFILIATE_ID });
}

const RETRIEVED_AT = '2026-07-28T00:00:00.000Z';

const ALA_TOP10: BannedBookCitation = {
  label: 'ALA Top 10 Most Challenged Books',
  href: 'https://www.ala.org/advocacy/bbooks/frequentlychallengedbooks/top10',
  publisher: 'American Library Association',
};

const PEN_BOOK_BANS: BannedBookCitation = {
  label: 'PEN America Book Bans hub',
  href: 'https://pen.org/book-bans/',
  publisher: 'PEN America',
};

const PEN_INDEX_2023: BannedBookCitation = {
  label: 'PEN America Index of School Book Bans 2022–2023',
  href: 'https://pen.org/book-bans/2023-banned-book-list/',
  publisher: 'PEN America',
};

const PEN_INDEX_2022: BannedBookCitation = {
  label: 'PEN America Index of School Book Bans 2021–2022 (PDF)',
  href: 'https://docs.house.gov/meetings/GO/GO02/20220407/114616/HHRG-117-GO02-20220407-SD018.pdf',
  publisher: 'PEN America',
};

const PEN_INDEX_2024: BannedBookCitation = {
  label: 'PEN America Index of School Book Bans 2023–2024',
  href: 'https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/',
  publisher: 'PEN America',
};

const PEN_INDEX_DATA: BannedBookCitation = {
  label: 'PEN America Book Ban Index Data',
  href: 'https://pen.org/book-bans/pen-america-book-ban-index-data/',
  publisher: 'PEN America',
};

const NPR_PEN_2023: BannedBookCitation = {
  label: 'School book bans show no signs of slowing, PEN America finds',
  href: 'https://www.npr.org/2023/09/21/1200725104/book-bans-school-pen-america',
  publisher: 'NPR',
  publishedAt: '2023-09-21',
};

const NPR_ALA_2024: BannedBookCitation = {
  label: 'The number of book titles that people tried to ban rose by 65% last year',
  href: 'https://www.npr.org/2024/03/14/1238647724/the-number-of-book-titles-that-people-tried-to-ban-rose-by-65-last-year',
  publisher: 'NPR',
  publishedAt: '2024-03-14',
};

function seedContentHash(id: string, title: string): string {
  return createHash('sha256').update(`${id}${title}`).digest('hex');
}

function provenance(source: string, sourceUrl: string, id: string, title: string) {
  return {
    source,
    sourceUrl,
    retrievedAt: RETRIEVED_AT,
    contentHash: seedContentHash(id, title),
  };
}

const RAW_BOOKS: BannedBookRecord[] = [
  {
    id: 'bb-book-bluest-eye',
    slug: 'the-bluest-eye',
    title: 'The Bluest Eye',
    authors: [{ name: 'Toni Morrison', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780307278449' }],
    description:
      'Toni Morrison’s debut novel follows Pecola Breedlove, a young Black girl in 1940s Ohio, as she internalizes white standards of beauty. The book is widely taught and frequently appears on public challenge lists for its depiction of sexual abuse and race.',
    publishedDate: '1970',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Public school district',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: ALA_TOP10,
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Independent school district',
        schoolYear: '2022-2023',
        challengeYear: 2022,
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
      {
        state: 'MO',
        status: 'reported',
        citation: NPR_PEN_2023,
      },
    ],
    citations: [ALA_TOP10, PEN_BOOK_BANS, NPR_PEN_2023],
    purchaseLinks: seedPurchaseLinks('9780307278449'),
    provenance: provenance(
      'American Library Association',
      ALA_TOP10.href,
      'bb-book-bluest-eye',
      'The Bluest Eye',
    ),
  },
  {
    id: 'bb-book-beloved',
    slug: 'beloved',
    title: 'Beloved',
    authors: [{ name: 'Toni Morrison', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781400033416' }],
    description:
      'Set after the Civil War, Morrison’s Pulitzer-winning novel centers on Sethe, a formerly enslaved woman haunted by the past. Public challenge records often cite violence, sexual content, and discussions of slavery’s legacy in school contexts.',
    publishedDate: '1987',
    challenges: [
      {
        state: 'VA',
        jurisdictionLabel: 'School board',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
      {
        state: 'FL',
        status: 'reported',
        citation: NPR_PEN_2023,
      },
    ],
    citations: [ALA_TOP10, PEN_INDEX_2023, NPR_ALA_2024],
    purchaseLinks: seedPurchaseLinks('9781400033416'),
    provenance: provenance('PEN America', PEN_INDEX_2023.href, 'bb-book-beloved', 'Beloved'),
  },
  {
    id: 'bb-book-hate-u-give',
    slug: 'the-hate-u-give',
    title: 'The Hate U Give',
    authors: [{ name: 'Angie Thomas', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780062498533' }],
    description:
      'Angie Thomas’s young-adult novel follows Starr Carter, a Black teenager who witnesses a police shooting and navigates activism, identity, and community pressure. It appears often on school challenge lists tied to profanity and depictions of racism and police violence.',
    publishedDate: '2017',
    challenges: [
      {
        state: 'TX',
        jurisdictionLabel: 'Independent school district',
        schoolYear: '2021-2022',
        status: 'reported',
        citation: PEN_INDEX_DATA,
      },
      {
        state: 'UT',
        status: 'reported',
        citation: NPR_PEN_2023,
      },
      {
        state: 'PA',
        status: 'reported',
        citation: PEN_BOOK_BANS,
      },
    ],
    citations: [ALA_TOP10, PEN_INDEX_2023, NPR_PEN_2023],
    purchaseLinks: seedPurchaseLinks('9780062498533'),
    provenance: provenance(
      'PEN America',
      PEN_BOOK_BANS.href,
      'bb-book-hate-u-give',
      'The Hate U Give',
    ),
  },
  {
    id: 'bb-book-stamped',
    slug: 'stamped-racism-antiracism-and-you',
    title: 'Stamped: Racism, Antiracism, and You',
    authors: [
      { name: 'Jason Reynolds', role: 'author' },
      { name: 'Ibram X. Kendi', role: 'author' },
    ],
    identifiers: [{ system: 'isbn-13', value: '9780316453691' }],
    description:
      'Jason Reynolds adapts Ibram X. Kendi’s history of racist ideas for young readers, tracing how prejudice persists in law, culture, and everyday life. Challenge records often frame the book as divisive or unsuitable for classroom use.',
    publishedDate: '2020',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Public school district',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
      {
        state: 'TN',
        status: 'reported',
        citation: NPR_PEN_2023,
      },
    ],
    citations: [ALA_TOP10, PEN_BOOK_BANS, NPR_ALA_2024],
    purchaseLinks: seedPurchaseLinks('9780316453691'),
    provenance: provenance(
      'PEN America',
      PEN_INDEX_2023.href,
      'bb-book-stamped',
      'Stamped: Racism, Antiracism, and You',
    ),
  },
  {
    id: 'bb-book-between-world-and-me',
    slug: 'between-the-world-and-me',
    title: 'Between the World and Me',
    authors: [{ name: 'Ta-Nehisi Coates', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780812993547' }],
    description:
      'Written as a letter to his son, Coates examines how race, violence, and American history shape Black life. The National Book Award winner is frequently challenged in schools for its discussion of racism, police violence, and the body.',
    publishedDate: '2015',
    challenges: [
      {
        state: 'TX',
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
      {
        state: 'FL',
        status: 'reported',
        citation: NPR_PEN_2023,
      },
    ],
    citations: [PEN_INDEX_2023, PEN_BOOK_BANS, NPR_PEN_2023],
    purchaseLinks: seedPurchaseLinks('9780812993547'),
    provenance: provenance(
      'PEN America',
      PEN_INDEX_2023.href,
      'bb-book-between-world-and-me',
      'Between the World and Me',
    ),
  },
  {
    id: 'bb-book-caged-bird',
    slug: 'i-know-why-the-caged-bird-sings',
    title: 'I Know Why the Caged Bird Sings',
    authors: [{ name: 'Maya Angelou', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780345514400' }],
    description:
      'Maya Angelou’s memoir of growing up in the Jim Crow South recounts family, migration, literacy, and survival after sexual assault. It is among the most frequently challenged classics in U.S. libraries and schools.',
    publishedDate: '1969',
    challenges: [
      {
        state: 'FL',
        status: 'reported',
        citation: ALA_TOP10,
      },
      {
        state: 'MO',
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
      {
        state: 'UT',
        status: 'reported',
        citation: NPR_ALA_2024,
      },
    ],
    citations: [ALA_TOP10, PEN_INDEX_2023, NPR_ALA_2024],
    purchaseLinks: seedPurchaseLinks('9780345514400'),
    provenance: provenance(
      'American Library Association',
      ALA_TOP10.href,
      'bb-book-caged-bird',
      'I Know Why the Caged Bird Sings',
    ),
  },
  {
    id: 'bb-book-color-purple',
    slug: 'the-color-purple',
    title: 'The Color Purple',
    authors: [{ name: 'Alice Walker', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780156028356' }],
    description:
      'Alice Walker’s epistolary novel follows Celie, a Black woman in the early twentieth-century South, as she finds voice, community, and self-determination. Public challenge records cite sexual content, violence, and LGBTQ themes.',
    publishedDate: '1982',
    challenges: [
      {
        state: 'TX',
        status: 'reported',
        citation: ALA_TOP10,
      },
      {
        state: 'FL',
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
    ],
    citations: [ALA_TOP10, PEN_BOOK_BANS, NPR_PEN_2023],
    purchaseLinks: seedPurchaseLinks('9780156028356'),
    provenance: provenance(
      'American Library Association',
      ALA_TOP10.href,
      'bb-book-color-purple',
      'The Color Purple',
    ),
  },
  {
    id: 'bb-book-how-to-be-antiracist',
    slug: 'how-to-be-an-antiracist',
    title: 'How to Be an Antiracist',
    authors: [{ name: 'Ibram X. Kendi', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780525509288' }],
    description:
      'Ibram X. Kendi blends memoir and history to define racism and antiracism as actionable choices rather than fixed identities. School and library challenges often target its classroom use and discussion of systemic racism.',
    publishedDate: '2019',
    challenges: [
      {
        state: 'FL',
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
      {
        state: 'TX',
        status: 'reported',
        citation: NPR_PEN_2023,
      },
    ],
    citations: [PEN_INDEX_2023, PEN_INDEX_DATA, NPR_ALA_2024],
    purchaseLinks: seedPurchaseLinks('9780525509288'),
    provenance: provenance(
      'PEN America',
      PEN_INDEX_DATA.href,
      'bb-book-how-to-be-antiracist',
      'How to Be an Antiracist',
    ),
  },
  {
    id: 'bb-book-invisible-man',
    slug: 'invisible-man',
    title: 'Invisible Man',
    authors: [{ name: 'Ralph Ellison', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780679732761' }],
    description:
      'Ralph Ellison’s landmark novel follows an unnamed Black narrator from the Jim Crow South through Harlem, exposing how institutions render Black citizens unseen. Challenge records cite language, race themes, and suitability for secondary students.',
    publishedDate: '1952',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Collier County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: 'More Than 300 Book Titles Banned by Collier County, FL',
          href: 'https://pen.org/press-release/more-than-300-book-titles-banned-by-collier-county-fl-including-literary-classics-by-aldous-huxley-ralph-ellison-and-joseph-heller/',
          publisher: 'PEN America',
          publishedAt: '2023-11-06',
        },
      },
      {
        state: 'NC',
        jurisdictionLabel: 'Randolph County School System',
        challengeYear: 2013,
        status: 'rescinded',
        citation: {
          label: 'Randolph County Board of Education reverses ban on Invisible Man',
          href: 'https://www.acluofnorthcarolina.org/press-releases/randolph-county-board-education-reverses-ban-invisible-man/',
          publisher: 'ACLU of North Carolina',
          publishedAt: '2013-09',
        },
      },
    ],
    citations: [PEN_INDEX_2024, PEN_BOOK_BANS, NPR_ALA_2024],
    purchaseLinks: seedPurchaseLinks('9780679732761'),
    provenance: provenance(
      'American Library Association',
      ALA_TOP10.href,
      'bb-book-invisible-man',
      'Invisible Man',
    ),
  },
  {
    id: 'bb-book-native-son',
    slug: 'native-son',
    title: 'Native Son',
    authors: [{ name: 'Richard Wright', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780060837563' }],
    description:
      'Richard Wright’s novel centers on Bigger Thomas, a young Black man in 1930s Chicago whose choices unfold under poverty, segregation, and media scrutiny. It remains a staple of American literature and a recurring target of school challenges.',
    publishedDate: '1940',
    challenges: [
      {
        state: 'TX',
        status: 'reported',
        citation: ALA_TOP10,
      },
      {
        state: 'FL',
        status: 'reported',
        citation: NPR_PEN_2023,
      },
      {
        state: 'MO',
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
    ],
    citations: [ALA_TOP10, PEN_INDEX_2023, NPR_PEN_2023],
    purchaseLinks: seedPurchaseLinks('9780060837563'),
    provenance: provenance(
      'American Library Association',
      ALA_TOP10.href,
      'bb-book-native-son',
      'Native Son',
    ),
  },
  {
    id: 'bb-book-underground-railroad',
    slug: 'the-underground-railroad',
    title: 'The Underground Railroad',
    authors: [{ name: 'Colson Whitehead', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780345804327' }],
    description:
      'Whitehead’s Pulitzer-winning novel reimagines the Underground Railroad as an actual rail network while following Cora’s escape from a Georgia plantation. Conroe ISD and other Texas districts removed it from classroom instruction alongside other race-centered titles.',
    publishedDate: '2016',
    challenges: [
      {
        state: 'TX',
        jurisdictionLabel: 'Conroe Independent School District',
        schoolYear: '2023-2024',
        status: 'reported',
        citation: {
          label: 'Conroe ISD bans 19 books from classrooms',
          href: 'https://www.houstonchronicle.com/neighborhood/conroe/article/conroe-isd-book-policy-ban-19520063.php',
          publisher: 'Houston Chronicle',
        },
      },
    ],
    citations: [
      {
        label: 'Conroe ISD bans 19 books from classrooms',
        href: 'https://www.houstonchronicle.com/neighborhood/conroe/article/conroe-isd-book-policy-ban-19520063.php',
        publisher: 'Houston Chronicle',
      },
      {
        label: "Conroe ISD Trustees Won't Restore Books",
        href: 'https://www.houstonpress.com/news/conroe-isd-trustees-wont-restore-books-in-a-policy-one-calls-racist-18369680/',
        publisher: 'Houston Press',
      },
      PEN_BOOK_BANS,
    ],
    purchaseLinks: seedPurchaseLinks('9780345804327'),
    provenance: provenance(
      'Houston Chronicle',
      'https://www.houstonchronicle.com/neighborhood/conroe/article/conroe-isd-book-policy-ban-19520063.php',
      'bb-book-underground-railroad',
      'The Underground Railroad',
    ),
  },
  {
    id: 'bb-book-nickel-boys',
    slug: 'the-nickel-boys',
    title: 'The Nickel Boys',
    authors: [{ name: 'Colson Whitehead', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780385537070' }],
    description:
      'Whitehead’s novel draws on the real Dozier School for Boys to follow Elwood Curtis and Turner through a brutal Florida reform school. Wilson County, Tennessee, included it among hundreds of titles removed from school libraries in 2024.',
    publishedDate: '2019',
    challenges: [
      {
        state: 'TN',
        jurisdictionLabel: 'Wilson County Schools',
        schoolYear: '2024-2025',
        status: 'reported',
        citation: {
          label: 'Tennessee school district bans 390 books from libraries',
          href: 'https://nashvillebanner.com/2024/10/25/wilson-county-bans-390-books/',
          publisher: 'Nashville Banner',
          publishedAt: '2024-10-25',
        },
        challengeYear: 2024,
      },
    ],
    citations: [
      {
        label: 'Tennessee school district bans 390 books from libraries',
        href: 'https://nashvillebanner.com/2024/10/25/wilson-county-bans-390-books/',
        publisher: 'Nashville Banner',
        publishedAt: '2024-10-25',
      },
      {
        label: 'Banned in the USA: Beyond the Shelves',
        href: 'https://pen.org/report/beyond-the-shelves/',
        publisher: 'PEN America',
      },
      PEN_BOOK_BANS,
    ],
    purchaseLinks: seedPurchaseLinks('9780385537070'),
    provenance: provenance(
      'Nashville Banner',
      'https://nashvillebanner.com/2024/10/25/wilson-county-bans-390-books/',
      'bb-book-nickel-boys',
      'The Nickel Boys',
    ),
  },
  {
    id: 'bb-book-born-a-crime-stories-from-a-south-africa',
    slug: 'born-a-crime-stories-from-a-south-african-childhood',
    title: 'Born a Crime',
    authors: [{ name: 'Trevor Noah', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780399588174' }],
    description:
      'Noah’s memoir recounts growing up mixed-race in apartheid and post-apartheid South Africa, where his birth violated racial classification laws. PEN America notes the title among banned works, and Wilson County, Tennessee, removed it from high school libraries.',
    publishedDate: '2016',
    challenges: [
      {
        state: 'TN',
        jurisdictionLabel: 'Wilson County Schools',
        schoolYear: '2024-2025',
        status: 'reported',
        citation: {
          label: 'Tennessee school district bans 390 books from libraries',
          href: 'https://nashvillebanner.com/2024/10/25/wilson-county-bans-390-books/',
          publisher: 'Nashville Banner',
          publishedAt: '2024-10-25',
        },
        challengeYear: 2024,
      },
    ],
    citations: [
      {
        label: 'Banned in the USA: Beyond the Shelves',
        href: 'https://pen.org/report/beyond-the-shelves/',
        publisher: 'PEN America',
      },
      {
        label: 'Tennessee school district bans 390 books from libraries',
        href: 'https://nashvillebanner.com/2024/10/25/wilson-county-bans-390-books/',
        publisher: 'Nashville Banner',
        publishedAt: '2024-10-25',
      },
      PEN_BOOK_BANS,
    ],
    purchaseLinks: seedPurchaseLinks('9780399588174'),
    provenance: provenance(
      'PEN America',
      'https://pen.org/report/beyond-the-shelves/',
      'bb-book-born-a-crime-stories-from-a-south-africa',
      'Born a Crime',
    ),
  },
  {
    id: 'bb-book-heavy-an-american-memoir',
    slug: 'heavy-an-american-memoir',
    title: 'Heavy',
    authors: [{ name: 'Kiese Laymon', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781501125669' }],
    description:
      'Laymon’s memoir addresses racism, body image, gambling, and his relationship with his mother in Mississippi. Wentzville, Missouri, school officials removed it from libraries alongside other works centered on Black life, prompting a federal class-action suit.',
    publishedDate: '2018',
    challenges: [
      {
        state: 'MO',
        jurisdictionLabel: 'Wentzville R-IV School District',
        schoolYear: '2021-2022',
        status: 'reported',
        citation: {
          label: 'Wentzville R-IV School District class action complaint',
          href: 'https://www.aclu-mo.org/sites/default/files/field_documents/ck-w_v_wentzville_complaint.pdf',
          publisher: 'ACLU of Missouri',
        },
        challengeYear: 2022,
      },
    ],
    citations: [
      {
        label: 'Wentzville R-IV School District class action complaint',
        href: 'https://www.aclu-mo.org/sites/default/files/field_documents/ck-w_v_wentzville_complaint.pdf',
        publisher: 'ACLU of Missouri',
      },
      PEN_BOOK_BANS,
      {
        label: 'Read These Banned Books By Black Authors',
        href: 'https://www.today.com/popculture/books/banned-books-black-authors-list-rcna193062',
        publisher: 'TODAY',
        publishedAt: '2024-02',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781501125669'),
    provenance: provenance(
      'ACLU of Missouri',
      'https://www.aclu-mo.org/sites/default/files/field_documents/ck-w_v_wentzville_complaint.pdf',
      'bb-book-heavy-an-american-memoir',
      'Heavy',
    ),
  },
  {
    id: 'bb-book-caste-the-origins-of-our-discontents',
    slug: 'caste-the-origins-of-our-discontents',
    title: 'Caste',
    authors: [{ name: 'Isabel Wilkerson', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780593230251' }],
    description:
      'Wilkerson compares American racism to caste systems in India and Nazi Germany, arguing that hierarchy—not only individual prejudice—shapes U.S. life. News and advocacy reports document Texas school and library challenges to the book’s classroom use.',
    publishedDate: '2020',
    challenges: [
      {
        state: 'TX',
        status: 'reported',
        citation: {
          label: 'Read These Banned Books By Black Authors',
          href: 'https://www.today.com/popculture/books/banned-books-black-authors-list-rcna193062',
          publisher: 'TODAY',
          publishedAt: '2024-02',
        },
      },
    ],
    citations: [
      {
        label: 'Read These Banned Books By Black Authors',
        href: 'https://www.today.com/popculture/books/banned-books-black-authors-list-rcna193062',
        publisher: 'TODAY',
        publishedAt: '2024-02',
      },
      PEN_BOOK_BANS,
      {
        label: 'The Bills Igniting Book Bans',
        href: 'https://pen.org/report/the-bills-igniting-book-bans/',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780593230251'),
    provenance: provenance(
      'TODAY',
      'https://www.today.com/popculture/books/banned-books-black-authors-list-rcna193062',
      'bb-book-caste-the-origins-of-our-discontents',
      'Caste',
    ),
  },
  {
    id: 'bb-book-hood-feminism-notes-from-the-women-that',
    slug: 'hood-feminism-notes-from-the-women-that-a-movement-forgot',
    title: 'Hood Feminism',
    authors: [{ name: 'Mikki Kendall', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781635572957' }],
    description:
      'Kendall’s essay collection argues mainstream feminism has failed poor women and women of color on issues from hunger to violence. ALA-tracked challenge reporting documents removals in Florida and Texas tied to race and gender content.',
    publishedDate: '2020',
    challenges: [
      {
        state: 'FL',
        status: 'reported',
        citation: {
          label: 'Read These Banned Books By Black Authors',
          href: 'https://www.today.com/popculture/books/banned-books-black-authors-list-rcna193062',
          publisher: 'TODAY',
          publishedAt: '2024-02',
        },
      },
      {
        state: 'TX',
        status: 'reported',
        citation: {
          label: 'Read These Banned Books By Black Authors',
          href: 'https://www.today.com/popculture/books/banned-books-black-authors-list-rcna193062',
          publisher: 'TODAY',
          publishedAt: '2024-02',
        },
      },
    ],
    citations: [
      {
        label: 'Read These Banned Books By Black Authors',
        href: 'https://www.today.com/popculture/books/banned-books-black-authors-list-rcna193062',
        publisher: 'TODAY',
        publishedAt: '2024-02',
      },
      ALA_TOP10,
      PEN_BOOK_BANS,
    ],
    purchaseLinks: seedPurchaseLinks('9781635572957'),
    provenance: provenance(
      'TODAY',
      'https://www.today.com/popculture/books/banned-books-black-authors-list-rcna193062',
      'bb-book-hood-feminism-notes-from-the-women-that',
      'Hood Feminism',
    ),
  },
  {
    id: 'bb-book-salvage-the-bones',
    slug: 'salvage-the-bones',
    title: 'Salvage the Bones',
    authors: [{ name: 'Jesmyn Ward', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781608196265' }],
    description:
      'Ward’s National Book Award winner follows a working-class Black family in Mississippi preparing for Hurricane Katrina. Conroe ISD removed it from classroom instruction under a policy trustees later described as disproportionately affecting race-centered texts.',
    publishedDate: '2011',
    challenges: [
      {
        state: 'TX',
        jurisdictionLabel: 'Conroe Independent School District',
        schoolYear: '2023-2024',
        status: 'reported',
        citation: {
          label: "Conroe ISD Trustees Won't Restore Books",
          href: 'https://www.houstonpress.com/news/conroe-isd-trustees-wont-restore-books-in-a-policy-one-calls-racist-18369680/',
          publisher: 'Houston Press',
        },
      },
    ],
    citations: [
      {
        label: 'Conroe ISD bans 19 books from classrooms',
        href: 'https://www.houstonchronicle.com/neighborhood/conroe/article/conroe-isd-book-policy-ban-19520063.php',
        publisher: 'Houston Chronicle',
      },
      {
        label: "Conroe ISD Trustees Won't Restore Books",
        href: 'https://www.houstonpress.com/news/conroe-isd-trustees-wont-restore-books-in-a-policy-one-calls-racist-18369680/',
        publisher: 'Houston Press',
      },
      PEN_BOOK_BANS,
    ],
    purchaseLinks: seedPurchaseLinks('9781608196265'),
    provenance: provenance(
      'Houston Press',
      'https://www.houstonpress.com/news/conroe-isd-trustees-wont-restore-books-in-a-policy-one-calls-racist-18369680/',
      'bb-book-salvage-the-bones',
      'Salvage the Bones',
    ),
  },
  {
    id: 'bb-book-their-eyes-were-watching-god',
    slug: 'their-eyes-were-watching-god',
    title: 'Their Eyes Were Watching God',
    authors: [{ name: 'Zora Neale Hurston', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780061120060' }],
    description:
      'Hurston’s Harlem Renaissance novel follows Janie Crawford through marriage, migration, and self-discovery in early twentieth-century Florida. ALA and PEN America records document repeated school challenges citing sexual content and racial themes.',
    publishedDate: '1937',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Collier County Public Schools',
        schoolYear: '2023-2024',
        status: 'reported',
        citation: PEN_INDEX_2024,
        challengeYear: 2023,
      },
      {
        state: 'VA',
        jurisdictionLabel: 'Stonewall Jackson High School (Prince William County Public Schools)',
        status: 'rescinded',
        citation: {
          label: 'Their Eyes Were Watching God — FIRE First Amendment Library',
          href: 'https://www.thefire.org/first-amendment-library/special-collections/banned-challenged-book/their-eyes-were-watching-god/',
          publisher: 'FIRE',
        },
        challengeYear: 1997,
      },
    ],
    citations: [
      {
        label: 'Their Eyes Were Watching God — FIRE First Amendment Library',
        href: 'https://www.thefire.org/first-amendment-library/special-collections/banned-challenged-book/their-eyes-were-watching-god/',
        publisher: 'FIRE',
      },
      PEN_INDEX_2024,
      {
        label: 'Read These Banned Books By Black Authors',
        href: 'https://www.today.com/popculture/books/banned-books-black-authors-list-rcna193062',
        publisher: 'TODAY',
        publishedAt: '2024-02',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780061120060'),
    provenance: provenance(
      'American Library Association',
      'https://www.ala.org/advocacy/bbooks/frequentlychallengedbooks/classics',
      'bb-book-their-eyes-were-watching-god',
      'Their Eyes Were Watching God',
    ),
  },
  {
    id: 'bb-book-sula',
    slug: 'sula',
    title: 'Sula',
    authors: [{ name: 'Toni Morrison', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781400033430' }],
    description:
      'Morrison’s novel centers on the friendship between Sula Peace and Nel Wright in a Ohio Bottoms community shaped by migration and loss. PEN America and ALA records document school removals tied to sexuality, language, and moral objections.',
    publishedDate: '1973',
    challenges: [
      {
        state: 'VA',
        jurisdictionLabel: 'Madison County Public Schools',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: PEN_INDEX_2023,
        challengeYear: 2023,
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Collier County Public Schools',
        schoolYear: '2023-2024',
        status: 'reported',
        citation: PEN_INDEX_2024,
        challengeYear: 2023,
      },
    ],
    citations: [PEN_INDEX_2023, PEN_INDEX_2024, PEN_BOOK_BANS],
    purchaseLinks: seedPurchaseLinks('9781400033430'),
    provenance: provenance(
      'PEN America',
      'https://pen.org/book-bans/2023-banned-book-list/',
      'bb-book-sula',
      'Sula',
    ),
  },
  {
    id: 'bb-book-kindred',
    slug: 'kindred',
    title: 'Kindred',
    authors: [{ name: 'Octavia E. Butler', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780807083697' }],
    description:
      'Butler’s science-fiction novel sends Dana, a Black writer in 1970s California, repeatedly to a Maryland plantation where she must navigate slavery’s violence to survive. School ban records cite sexual content and discomfort with historical depiction.',
    publishedDate: '1979',
    challenges: [
      {
        state: 'MO',
        jurisdictionLabel: 'Wentzville School District',
        schoolYear: '2022-2023',
        titleAtChallenge: 'Kindred: A Graphic Novel Adaptation',
        status: 'reported',
        citation: PEN_INDEX_2023,
        challengeYear: 2022,
      },
    ],
    citations: [PEN_INDEX_2023, PEN_INDEX_DATA, NPR_PEN_2023],
    purchaseLinks: seedPurchaseLinks('9780807083697'),
    provenance: provenance(
      'PEN America',
      'https://pen.org/book-bans/2023-banned-book-list/',
      'bb-book-kindred',
      'Kindred',
    ),
  },
  {
    id: 'bb-book-push',
    slug: 'push',
    title: 'Push',
    authors: [{ name: 'Sapphire', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780679766759' }],
    description:
      'Sapphire’s novel follows Claireece “Precious” Jones, a Harlem teenager navigating illiteracy, abuse, and pregnancy while finding voice in an alternative school. PEN America documents multiple Utah and Texas school district bans.',
    publishedDate: '1996',
    challenges: [
      {
        state: 'UT',
        jurisdictionLabel: 'Alpine School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: PEN_INDEX_2023,
        challengeYear: 2022,
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Conroe Independent School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
    ],
    citations: [PEN_INDEX_2023, PEN_BOOK_BANS, NPR_PEN_2023],
    purchaseLinks: seedPurchaseLinks('9780679766759'),
    provenance: provenance(
      'PEN America',
      'https://pen.org/book-bans/2023-banned-book-list/',
      'bb-book-push',
      'Push',
    ),
  },
  {
    id: 'bb-book-autobiography-of-malcolm-x',
    slug: 'the-autobiography-of-malcolm-x',
    title: 'The Autobiography of Malcolm X',
    authors: [
      { name: 'Malcolm X', role: 'author' },
      { name: 'Alex Haley', role: 'author' },
    ],
    identifiers: [{ system: 'isbn-13', value: '9780345350688' }],
    description:
      'Malcolm X and Alex Haley recount Malcolm’s path from Omaha childhood through prison, Nation of Islam leadership, pilgrimage, and assassination. ALA frequently-challenged lists document objections to anti-white statements and Muslim themes in schools.',
    publishedDate: '1965',
    challenges: [
      { state: 'FL', status: 'reported', citation: ALA_TOP10 },
      {
        state: 'TN',
        status: 'reported',
        citation: {
          label: 'ALA Banned and Challenged Classics',
          href: 'https://www.ala.org/advocacy/bbooks/frequentlychallengedbooks/classics',
          publisher: 'American Library Association',
        },
      },
    ],
    citations: [
      {
        label: 'ALA Banned and Challenged Classics',
        href: 'https://www.ala.org/advocacy/bbooks/frequentlychallengedbooks/classics',
        publisher: 'American Library Association',
      },
      ALA_TOP10,
      {
        label: 'Read These Banned Books By Black Authors',
        href: 'https://www.today.com/popculture/books/banned-books-black-authors-list-rcna193062',
        publisher: 'TODAY',
        publishedAt: '2024-02',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780345350688'),
    provenance: provenance(
      'American Library Association',
      'https://www.ala.org/advocacy/bbooks/frequentlychallengedbooks/classics',
      'bb-book-autobiography-of-malcolm-x',
      'The Autobiography of Malcolm X',
    ),
  },
  {
    id: 'bb-book-fire-next-time',
    slug: 'the-fire-next-time',
    title: 'The Fire Next Time',
    authors: [{ name: 'James Baldwin', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780679744726' }],
    description:
      'Baldwin’s two essays—“My Dungeon Shook” and “Down at the Cross”—address race, religion, and the moral cost of segregation to the nation. School and library challenge records cite incendiary language and political content.',
    publishedDate: '1963',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: PEN_INDEX_2023,
        challengeYear: 2022,
      },
    ],
    citations: [
      PEN_INDEX_2023,
      {
        label: 'Read These Banned Books By Black Authors',
        href: 'https://www.today.com/popculture/books/banned-books-black-authors-list-rcna193062',
        publisher: 'TODAY',
        publishedAt: '2024-02',
      },
      PEN_BOOK_BANS,
    ],
    purchaseLinks: seedPurchaseLinks('9780679744726'),
    provenance: provenance(
      'PEN America',
      'https://pen.org/book-bans/2023-banned-book-list/',
      'bb-book-fire-next-time',
      'The Fire Next Time',
    ),
  },
  {
    id: 'bb-book-all-american-boys',
    slug: 'all-american-boys',
    title: 'All American Boys',
    authors: [
      { name: 'Jason Reynolds', role: 'author' },
      { name: 'Brendan Kiely', role: 'author' },
    ],
    identifiers: [{ system: 'isbn-13', value: '9781481463348' }],
    description:
      'Dual-narrative YA novel about Rashad, a Black teen beaten by police, and Quinn, a white classmate who witnesses the assault. Frequently removed from school libraries for depictions of police brutality, profanity, and racial injustice.',
    publishedDate: '2015',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: PEN_INDEX_2023,
        challengeYear: 2022,
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Texarkana Independent School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: {
          label: 'All American Boys censorship history (PEN America aggregates)',
          href: 'https://www.banned-books.org/books/all-american-boys',
          publisher: 'Banned Books',
        },
        challengeYear: 2022,
      },
      {
        state: 'MS',
        jurisdictionLabel: 'Madison County Schools',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: {
          label: 'All American Boys censorship history (PEN America aggregates)',
          href: 'https://www.banned-books.org/books/all-american-boys',
          publisher: 'Banned Books',
        },
        challengeYear: 2022,
      },
    ],
    citations: [
      PEN_INDEX_2023,
      {
        label: 'All American Boys censorship history',
        href: 'https://www.banned-books.org/books/all-american-boys',
        publisher: 'Banned Books',
      },
      NPR_PEN_2023,
    ],
    purchaseLinks: seedPurchaseLinks('9781481463348'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/2023-banned-book-list/',
      'bb-book-all-american-boys',
      'All American Boys',
    ),
  },
  {
    id: 'bb-book-dear-martin',
    slug: 'dear-martin',
    title: 'Dear Martin',
    authors: [{ name: 'Nic Stone', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781101939529' }],
    description:
      'YA debut following Justyce McAllister, a Black honor student wrongfully arrested, who writes letters to Dr. Martin Luther King Jr. while navigating racism and police violence. Documented in dozens of PEN-indexed school removals since 2021.',
    publishedDate: '2017',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: {
          label: 'Dear Martin — PEN America ban records',
          href: 'https://bannedindex.org/books/4529',
          publisher: 'Banned Index',
        },
        challengeYear: 2022,
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Frisco Independent School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: {
          label: 'Dear Martin — PEN America ban records',
          href: 'https://bannedindex.org/books/4529',
          publisher: 'Banned Index',
        },
        challengeYear: 2022,
      },
      {
        state: 'SC',
        jurisdictionLabel: 'School District of Pickens County',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: {
          label: 'Dear Martin censorship history (PEN America aggregates)',
          href: 'https://www.banned-books.org/books/dear-martin',
          publisher: 'Banned Books',
        },
        challengeYear: 2022,
      },
    ],
    citations: [
      {
        label: 'Dear Martin — PEN America ban records',
        href: 'https://bannedindex.org/books/4529',
        publisher: 'Banned Index',
      },
      {
        label: 'Dear Martin censorship history',
        href: 'https://www.banned-books.org/books/dear-martin',
        publisher: 'Banned Books',
      },
      {
        label: 'Dear Martin by Nic Stone — publisher record',
        href: 'https://www.penguinrandomhouse.com/books/534050/dear-martin-by-nic-stone/',
        publisher: 'Penguin Random House',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781101939529'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/',
      'bb-book-dear-martin',
      'Dear Martin',
    ),
  },
  {
    id: 'bb-book-poet-x',
    slug: 'the-poet-x',
    title: 'The Poet X',
    authors: [{ name: 'Elizabeth Acevedo', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780062662804' }],
    description:
      'National Book Award–winning novel-in-verse about Xiomara, an Afro-Latina teen in Harlem who finds her voice through slam poetry while questioning faith, family, and identity. Among the most PEN-documented YA removals for race and religious themes.',
    publishedDate: '2018',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: {
          label: 'The Poet X censorship history (PEN America aggregates)',
          href: 'https://www.banned-books.org/books/the-poet-x',
          publisher: 'Banned Books',
        },
        challengeYear: 2022,
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Frisco Independent School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: {
          label: 'The Poet X censorship history (PEN America aggregates)',
          href: 'https://www.banned-books.org/books/the-poet-x',
          publisher: 'Banned Books',
        },
        challengeYear: 2022,
      },
      {
        state: 'SC',
        jurisdictionLabel: 'Beaufort County School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: {
          label: 'The Poet X censorship history (PEN America aggregates)',
          href: 'https://www.banned-books.org/books/the-poet-x',
          publisher: 'Banned Books',
        },
        challengeYear: 2022,
      },
    ],
    citations: [
      PEN_INDEX_2023,
      {
        label: 'The Poet X censorship history',
        href: 'https://www.banned-books.org/books/the-poet-x',
        publisher: 'Banned Books',
      },
      {
        label: 'More Than 300 Book Titles Banned by Collier County, FL',
        href: 'https://pen.org/press-release/more-than-300-book-titles-banned-by-collier-county-fl-including-literary-classics-by-aldous-huxley-ralph-ellison-and-joseph-heller/',
        publisher: 'PEN America',
        publishedAt: '2023-11-06',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780062662804'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/2023-banned-book-list/',
      'bb-book-poet-x',
      'The Poet X',
    ),
  },
  {
    id: 'bb-book-homegoing',
    slug: 'homegoing',
    title: 'Homegoing',
    authors: [{ name: 'Yaa Gyasi', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781101947135' }],
    description:
      'Debut novel tracing two half-sisters and their descendants from 18th-century Ghana through slavery and the African diaspora to modern America. Widely taught and repeatedly removed from school libraries for racial and historical themes.',
    publishedDate: '2016',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Charlotte County Public Schools',
        schoolYear: '2023-2024',
        status: 'reported',
        citation: {
          label: 'Homegoing banned in Charlotte County Public Schools, FL',
          href: 'https://bannedindex.org/bans/31714',
          publisher: 'Banned Index',
        },
        challengeYear: 2023,
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Seminole County Public Schools',
        schoolYear: '2023-2024',
        status: 'reported',
        citation: {
          label: 'Homegoing banned in Seminole County Public Schools, FL',
          href: 'https://bannedindex.org/bans/31719',
          publisher: 'Banned Index',
        },
        challengeYear: 2023,
      },
      {
        state: 'MO',
        jurisdictionLabel: 'Wentzville School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: {
          label: 'Homegoing censorship history (PEN America aggregates)',
          href: 'https://www.banned-books.org/books/homegoing',
          publisher: 'Banned Books',
        },
        challengeYear: 2022,
      },
    ],
    citations: [
      {
        label: 'Homegoing censorship history',
        href: 'https://www.banned-books.org/books/homegoing',
        publisher: 'Banned Books',
      },
      {
        label: 'Homegoing banned in Charlotte County Public Schools, FL',
        href: 'https://bannedindex.org/bans/31714',
        publisher: 'Banned Index',
      },
      {
        label: 'PEN America Index of School Book Bans 2023–2024',
        href: 'https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781101947135'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/',
      'bb-book-homegoing',
      'Homegoing',
    ),
  },
  {
    id: 'bb-book-long-way-down',
    slug: 'long-way-down',
    title: 'Long Way Down',
    authors: [{ name: 'Jason Reynolds', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781481438261' }],
    description:
      'Verse novel in which Will, mourning his murdered brother, descends in an elevator and confronts ghosts of gun-violence cycles. PEN indexed removals in Florida and Wisconsin during the 2022–2024 school years.',
    publishedDate: '2017',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: {
          label: 'Long Way Down censorship history (PEN America aggregates)',
          href: 'https://www.banned-books.org/books/long-way-down',
          publisher: 'Banned Books',
        },
        challengeYear: 2022,
      },
      {
        state: 'WI',
        jurisdictionLabel: 'Elkhorn Area School District',
        schoolYear: '2023-2024',
        status: 'reported',
        citation: {
          label: 'Long Way Down censorship history (PEN America aggregates)',
          href: 'https://www.banned-books.org/books/long-way-down',
          publisher: 'Banned Books',
        },
        challengeYear: 2023,
      },
    ],
    citations: [
      {
        label: 'Long Way Down censorship history',
        href: 'https://www.banned-books.org/books/long-way-down',
        publisher: 'Banned Books',
      },
      PEN_INDEX_2023,
      {
        label: 'Long Way Down — publisher record',
        href: 'https://www.simonandschuster.net/books/Long-Way-Down/Jason-Reynolds/9781481438261',
        publisher: 'Simon & Schuster',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781481438261'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/2023-banned-book-list/',
      'bb-book-long-way-down',
      'Long Way Down',
    ),
  },
  {
    id: 'bb-book-ghost-boys',
    slug: 'ghost-boys',
    title: 'Ghost Boys',
    authors: [{ name: 'Jewell Parker Rhodes', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780316262286' }],
    description:
      'Middle-grade novel about Jerome, a Black boy killed by police, who joins the ghosts of Emmett Till and other victims to witness the aftermath of his death. Removed from multiple districts for depictions of police violence and racism.',
    publishedDate: '2018',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: {
          label: 'Ghost Boys censorship history (PEN America aggregates)',
          href: 'https://www.banned-books.org/books/ghost-boys',
          publisher: 'Banned Books',
        },
        challengeYear: 2022,
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Seminole County Public Schools',
        schoolYear: '2023-2024',
        status: 'reported',
        citation: {
          label: 'Ghost Boys banned in Seminole County Public Schools, FL',
          href: 'https://bannedindex.org/bans/36473',
          publisher: 'Banned Index',
        },
        challengeYear: 2023,
      },
      {
        state: 'TN',
        jurisdictionLabel: 'Hamilton County Schools',
        schoolYear: '2021-2022',
        status: 'reported',
        citation: {
          label: 'Ghost Boys censorship history (PEN America aggregates)',
          href: 'https://www.banned-books.org/books/ghost-boys',
          publisher: 'Banned Books',
        },
        challengeYear: 2021,
      },
    ],
    citations: [
      {
        label: 'Ghost Boys censorship history',
        href: 'https://www.banned-books.org/books/ghost-boys',
        publisher: 'Banned Books',
      },
      {
        label: 'Ghost Boys banned in Seminole County Public Schools, FL',
        href: 'https://bannedindex.org/bans/36473',
        publisher: 'Banned Index',
      },
      {
        label: 'Banned Books 2022 – Ghost Boys',
        href: 'https://www.marshall.edu/library/bannedbooks/ghost-boys/',
        publisher: 'Marshall University Libraries',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780316262286'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/',
      'bb-book-ghost-boys',
      'Ghost Boys',
    ),
  },
  {
    id: 'bb-book-all-boys-arent-blue',
    slug: 'all-boys-arent-blue',
    title: "All Boys Aren't Blue",
    authors: [{ name: 'George M. Johnson', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780374312718' }],
    description:
      'Memoir-in-essays by a Black queer journalist on growing up in New Jersey and Virginia, covering identity, consent, family, and structural marginalization. Among the most frequently PEN-indexed removals of the 2021–2024 period.',
    publishedDate: '2020',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Escambia County Public Schools',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: {
          label: "All Boys Aren't Blue censorship history (PEN America aggregates)",
          href: 'https://www.banned-books.org/books/all-boys-arent-blue',
          publisher: 'Banned Books',
        },
        challengeYear: 2022,
      },
      {
        state: 'MO',
        jurisdictionLabel: 'Wentzville School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: {
          label: "All Boys Aren't Blue censorship history (PEN America aggregates)",
          href: 'https://www.banned-books.org/books/all-boys-arent-blue',
          publisher: 'Banned Books',
        },
        challengeYear: 2022,
      },
      {
        state: 'UT',
        jurisdictionLabel: 'Alpine School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: {
          label: "All Boys Aren't Blue censorship history (PEN America aggregates)",
          href: 'https://www.banned-books.org/books/all-boys-arent-blue',
          publisher: 'Banned Books',
        },
        challengeYear: 2022,
      },
    ],
    citations: [
      {
        label: "All Boys Aren't Blue censorship history",
        href: 'https://www.banned-books.org/books/all-boys-arent-blue',
        publisher: 'Banned Books',
      },
      {
        label: 'PEN America v. Escambia County School District',
        href: 'https://pen.org/pen-america-v-escambia-county/',
        publisher: 'PEN America',
      },
      {
        label: 'Banned in the USA: The Mounting Pressure to Censor',
        href: 'https://pen.org/report/book-bans-pressure-to-censor/',
        publisher: 'PEN America',
        publishedAt: '2023-04',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780374312718'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/2023-banned-book-list/',
      'bb-book-all-boys-arent-blue',
      "All Boys Aren't Blue",
    ),
  },
  {
    id: 'bb-book-monster',
    slug: 'monster',
    title: 'Monster',
    authors: [{ name: 'Walter Dean Myers', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780064407311' }],
    description:
      'Printz Honor novel presented as a screenplay written by Steve Harmon, a Black teen on trial for murder, examining the juvenile justice system. Challenged for language, violence, and racial themes in multiple PEN-indexed districts.',
    publishedDate: '1999',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Collier County Public Schools',
        schoolYear: '2023-2024',
        status: 'reported',
        citation: {
          label: 'Monster censorship history (PEN America aggregates)',
          href: 'https://www.banned-books.org/books/monster-walter-dean-myers',
          publisher: 'Banned Books',
        },
        challengeYear: 2023,
      },
      {
        state: 'TN',
        jurisdictionLabel: 'Hamilton County Schools',
        schoolYear: '2021-2022',
        status: 'reported',
        citation: {
          label: 'Monster censorship history (PEN America aggregates)',
          href: 'https://www.banned-books.org/books/monster-walter-dean-myers',
          publisher: 'Banned Books',
        },
        challengeYear: 2021,
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Indianola Community School District',
        schoolYear: '2023-2024',
        status: 'reported',
        citation: {
          label: 'Monster censorship history (PEN America aggregates)',
          href: 'https://www.banned-books.org/books/monster-walter-dean-myers',
          publisher: 'Banned Books',
        },
        challengeYear: 2023,
      },
    ],
    citations: [
      {
        label: 'Monster censorship history',
        href: 'https://www.banned-books.org/books/monster-walter-dean-myers',
        publisher: 'Banned Books',
      },
      {
        label: 'Monster — Banned Books Week guide',
        href: 'https://researchguides.gonzaga.edu/BannedBooksWeek/Monster',
        publisher: 'Gonzaga University Libraries',
      },
      {
        label: 'PEN America Index of School Book Bans 2023–2024',
        href: 'https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780064407311'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/',
      'bb-book-monster',
      'Monster',
    ),
  },
  {
    id: 'bb-book-1619-project-a-new-origin-story',
    slug: 'the-1619-project-a-new-origin-story',
    title: 'The 1619 Project: A New Origin Story',
    authors: [{ name: 'Nikole Hannah-Jones', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780593230572' }],
    description:
      "Expanded anthology reframing U.S. history through slavery and Black resistance, building on The New York Times Magazine's 1619 Project. Escambia County, Florida removed it from schools amid challenges to race-related instructional materials.",
    publishedDate: '2021',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Escambia County Public Schools',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: {
          label: 'The 1619 Project censorship history (PEN America aggregates)',
          href: 'https://www.banned-books.org/books/the-1619-project-a-new-origin-story',
          publisher: 'Banned Books',
        },
        challengeYear: 2022,
      },
    ],
    citations: [
      {
        label: 'The 1619 Project censorship history',
        href: 'https://www.banned-books.org/books/the-1619-project-a-new-origin-story',
        publisher: 'Banned Books',
      },
      {
        label: 'PEN America v. Escambia County School District',
        href: 'https://pen.org/pen-america-v-escambia-county/',
        publisher: 'PEN America',
      },
      PEN_INDEX_2023,
    ],
    purchaseLinks: seedPurchaseLinks('9780593230572'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/2023-banned-book-list/',
      'bb-book-1619-project-a-new-origin-story',
      'The 1619 Project: A New Origin Story',
    ),
  },
  {
    id: 'bb-book-brown-girl-dreaming',
    slug: 'brown-girl-dreaming',
    title: 'Brown Girl Dreaming',
    authors: [{ name: 'Jacqueline Woodson', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780399252518' }],
    description:
      'Woodson’s National Book Award–winning memoir in verse traces her childhood across Ohio, South Carolina, and Brooklyn amid the civil rights movement. PEN America documents school bans in Florida, Texas, Utah, and other states.',
    publishedDate: '2014',
    challenges: [
      { state: 'FL', status: 'reported', citation: PEN_INDEX_2023 },
      { state: 'TX', status: 'reported', citation: PEN_INDEX_2023 },
      { state: 'UT', status: 'reported', citation: PEN_INDEX_2023 },
    ],
    citations: [PEN_INDEX_2023, PEN_INDEX_DATA, NPR_ALA_2024],
    purchaseLinks: seedPurchaseLinks('9780399252518'),
    provenance: provenance(
      'PEN America',
      'https://pen.org/book-bans/2023-banned-book-list/',
      'bb-book-brown-girl-dreaming',
      'Brown Girl Dreaming',
    ),
  },
  {
    id: 'bb-book-dear-justyce',
    slug: 'dear-justyce',
    title: 'Dear Justyce',
    authors: [{ name: 'Nic Stone', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781984829665' }],
    description:
      'Stone’s sequel shifts focus to Quan, a Black teenager awaiting trial who writes letters to his friend Justyce. PEN America documents bans in Florida and Texas school districts alongside other Nic Stone titles.',
    publishedDate: '2020',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Frisco Independent School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
    ],
    citations: [
      PEN_INDEX_2023,
      {
        label: 'Florida School District Slaps Warning Labels on Books',
        href: 'https://pen.org/press-release/florida-school-district-slaps-stigmatizing-and-alarming-warning-labels-on-books-deemed-unsuitable-for-children/',
        publisher: 'PEN America',
      },
      NPR_PEN_2023,
    ],
    purchaseLinks: seedPurchaseLinks('9781984829665'),
    provenance: provenance(
      'PEN America',
      'https://pen.org/book-bans/2023-banned-book-list/',
      'bb-book-dear-justyce',
      'Dear Justyce',
    ),
  },
  {
    id: 'bb-book-out-of-darkness',
    slug: 'out-of-darkness',
    title: 'Out of Darkness',
    authors: [{ name: 'Ashley Hope Pérez', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781467742023' }],
    description:
      'Pérez’s novel follows a Mexican American girl and a Black boy in 1930s East Texas as community violence closes in on their relationship. PEN America records bans across Florida, Texas, Utah, and other states.',
    publishedDate: '2015',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        schoolYear: '2022-2023',
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Keller Independent School District',
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
      {
        state: 'UT',
        jurisdictionLabel: 'Alpine School District',
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
    ],
    citations: [PEN_INDEX_2023, PEN_INDEX_DATA, NPR_PEN_2023],
    purchaseLinks: seedPurchaseLinks('9781467742023'),
    provenance: provenance(
      'PEN America',
      'https://pen.org/book-bans/2023-banned-book-list/',
      'bb-book-out-of-darkness',
      'Out of Darkness',
    ),
  },
  {
    id: 'bb-book-all-because-you-matter',
    slug: 'all-because-you-matter',
    title: 'All Because You Matter',
    authors: [
      { name: 'Tami Charles', role: 'author' },
      { name: 'Bryan Collier', role: 'illustrator' },
    ],
    identifiers: [{ system: 'isbn-13', value: '9781338674743' }],
    description:
      'Charles and Collier’s picture book affirms Black children’s worth through lyrical address to a young reader. PEN America documents school bans in Florida, Missouri, and Texas alongside other race-centered titles.',
    publishedDate: '2020',
    challenges: [
      { state: 'FL', status: 'reported', citation: PEN_INDEX_2023 },
      { state: 'MO', status: 'reported', citation: PEN_INDEX_2023 },
      { state: 'TX', status: 'reported', citation: PEN_INDEX_2023 },
    ],
    citations: [PEN_INDEX_2023, PEN_INDEX_DATA, NPR_PEN_2023],
    purchaseLinks: seedPurchaseLinks('9781338674743'),
    provenance: provenance(
      'PEN America',
      'https://pen.org/book-bans/2023-banned-book-list/',
      'bb-book-all-because-you-matter',
      'All Because You Matter',
    ),
  },
  {
    id: 'bb-book-mondays-not-coming',
    slug: 'mondays-not-coming',
    title: "Monday's Not Coming",
    authors: [{ name: 'Tiffany D. Jackson', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780062422675' }],
    description:
      'Jackson’s thriller follows Claudia as she searches for her missing best friend Monday in a Washington, D.C., neighborhood where adults dismiss her concerns. PEN America documents bans in Pennsylvania, South Carolina, Utah, and North Carolina.',
    publishedDate: '2018',
    challenges: [
      { state: 'PA', status: 'reported', citation: PEN_INDEX_2023 },
      { state: 'SC', status: 'reported', citation: PEN_INDEX_2023 },
      { state: 'UT', status: 'reported', citation: PEN_INDEX_2023 },
    ],
    citations: [PEN_INDEX_2023, PEN_BOOK_BANS, NPR_ALA_2024],
    purchaseLinks: seedPurchaseLinks('9780062422675'),
    provenance: provenance(
      'PEN America',
      'https://pen.org/book-bans/2023-banned-book-list/',
      'bb-book-mondays-not-coming',
      "Monday's Not Coming",
    ),
  },
  {
    id: 'bb-book-narrative-of-the-life-of-frederick-douglass',
    slug: 'narrative-of-the-life-of-frederick-douglass',
    title: 'Narrative of the Life of Frederick Douglass, an American Slave',
    authors: [{ name: 'Frederick Douglass', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780486284996' }],
    description:
      'Douglass’s first autobiography recounts enslavement, literacy, resistance, and escape in antebellum Maryland. Edmond, Oklahoma, struck it from anchor-text curricula after House Bill 1775, and an ACLU lawsuit cites the removal as race-related censorship.',
    publishedDate: '1845',
    challenges: [
      {
        state: 'OK',
        jurisdictionLabel:
          'Edmond Public Schools (disputed curriculum removal; district denies a ban)',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: 'Lawsuit alleges book banning related to new Oklahoma law',
          href: 'https://kfor.com/news/local/lawsuit-alleges-book-banning-related-to-new-oklahoma-law/',
          publisher: 'KFOR',
          publishedAt: '2021-10',
        },
      },
    ],
    citations: [
      {
        label: 'Lawsuit alleges book banning related to new Oklahoma law',
        href: 'https://kfor.com/news/local/lawsuit-alleges-book-banning-related-to-new-oklahoma-law/',
        publisher: 'KFOR',
      },
      {
        label: 'Fearful of new laws, many teachers deterred from covering race-related topics',
        href: 'https://www.pbs.org/newshour/education/fearful-of-new-laws-many-teachers-deterred-from-covering-race-related-topics',
        publisher: 'PBS NewsHour',
      },
      {
        label: 'Narrative of the Life of Frederick Douglass – Banned Books',
        href: 'https://www.banned-books.org/books/narrative-of-the-life-of-frederick-douglass',
        publisher: 'Banned Books',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780486284996'),
    provenance: provenance(
      'KFOR',
      'https://kfor.com/news/local/lawsuit-alleges-book-banning-related-to-new-oklahoma-law/',
      'bb-book-narrative-of-the-life-of-frederick-douglass',
      'Narrative of the Life of Frederick Douglass, an American Slave',
    ),
  },
  {
    id: 'bb-book-so-you-want-to-talk-about-race',
    slug: 'so-you-want-to-talk-about-race',
    title: 'So You Want to Talk About Race',
    authors: [{ name: 'Ijeoma Oluo', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781580056779' }],
    description:
      'Oluo’s guide walks readers through privilege, police violence, intersectionality, and everyday conversations about racism. Central York, Pennsylvania, barred it from classroom use in 2021 along with other antiracist resources before student protests led to reinstatement.',
    publishedDate: '2018',
    challenges: [
      {
        state: 'PA',
        jurisdictionLabel: 'Central York School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'rescinded',
        citation: {
          label:
            'Student Action Results in Decision by School Board to “Unfreeze” Anti-Racist Resources in Central York, PA',
          href: 'https://www.oif.ala.org/student-action-results-in-decision-by-school-board-to-unfreeze-anti-racist-resources-in-central-york-pa/',
          publisher: 'ALA Office for Intellectual Freedom',
          publishedAt: '2021-09',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'North East Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label:
          'Student Action Results in Decision by School Board to “Unfreeze” Anti-Racist Resources in Central York, PA',
        href: 'https://www.oif.ala.org/student-action-results-in-decision-by-school-board-to-unfreeze-anti-racist-resources-in-central-york-pa/',
        publisher: 'ALA Office for Intellectual Freedom',
      },
      {
        label: "PEN America's Index of School Book Bans (2021-2022)",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          'Pennsylvania school district reverses ban on books by authors of color after backlash from students',
        href: 'https://www.seattletimes.com/nation-world/pennsylvania-school-district-reverses-ban-on-books-by-authors-of-color-after-backlash-from-students/',
        publisher: 'The Seattle Times',
        publishedAt: '2021-09-21',
      },
      {
        label: 'School District Maintains Ban of Antiracist Books Despite Student Protests',
        href: 'https://bookriot.com/central-york-book-ban-update/',
        publisher: 'Book Riot',
        publishedAt: '2021-09',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781580056779'),
    provenance: provenance(
      'ALA Office for Intellectual Freedom',
      'https://www.oif.ala.org/student-action-results-in-decision-by-school-board-to-unfreeze-anti-racist-resources-in-central-york-pa/',
      'bb-book-so-you-want-to-talk-about-race',
      'So You Want to Talk About Race',
    ),
  },
  {
    id: 'bb-book-an-african-american-and-latinx-history-of-the',
    slug: 'an-african-american-and-latinx-history-of-the-united-states',
    title: 'An African American and Latinx History of the United States',
    authors: [{ name: 'Paul Ortiz', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780807013106' }],
    description:
      'Ortiz’s bottom-up history links Black and Latinx labor, migration, and resistance from Reconstruction through the twenty-first century. Central York, Pennsylvania, and Texas districts removed or restricted it during 2020–2021 antiracist curriculum fights.',
    publishedDate: '2018',
    challenges: [
      {
        state: 'PA',
        jurisdictionLabel: 'Central York School District',
        schoolYear: '2020-2021',
        challengeYear: 2020,
        status: 'rescinded',
        citation: {
          label: 'Banned Books By Hispanic Authors – McLennan Community College',
          href: 'https://mclennan.libguides.com/hhm2024/banned',
          publisher: 'McLennan Community College Libraries',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'North East Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: 'An African American and Latinx History of the United States – Banned Books',
          href: 'https://www.banned-books.org/books/an-african-american-and-latinx-history-of-the-united-states',
          publisher: 'Banned Books',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Klein Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: 'Texas lawmaker Matt Krause targets 850 books he says could make students uneasy',
          href: 'https://www.npr.org/2021/10/28/1050013664/texas-lawmaker-matt-krause-launches-inquiry-into-850-books',
          publisher: 'NPR',
          publishedAt: '2021-10-28',
        },
      },
    ],
    citations: [
      {
        label: 'Texas lawmaker Matt Krause targets 850 books he says could make students uneasy',
        href: 'https://www.npr.org/2021/10/28/1050013664/texas-lawmaker-matt-krause-launches-inquiry-into-850-books',
        publisher: 'NPR',
        publishedAt: '2021-10-28',
      },
      {
        label: 'An African American and Latinx History of the United States – Banned Books',
        href: 'https://www.banned-books.org/books/an-african-american-and-latinx-history-of-the-united-states',
        publisher: 'Banned Books',
      },
      {
        label: 'Banned Books By Hispanic Authors – McLennan Community College',
        href: 'https://mclennan.libguides.com/hhm2024/banned',
        publisher: 'McLennan Community College Libraries',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780807013106'),
    provenance: provenance(
      'PEN America',
      'https://pen.org/book-bans/2023-banned-book-list/',
      'bb-book-an-african-american-and-latinx-history-of-the',
      'An African American and Latinx History of the United States',
    ),
  },
  {
    id: 'bb-book-white-rage',
    slug: 'white-rage',
    title: 'White Rage: The Unspoken Truth of Our Racial Divide',
    authors: [{ name: 'Carol Anderson', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781632864130' }],
    description:
      'Anderson argues that policy backlash—not only individual prejudice—has repeatedly blocked Black political and economic progress from Reconstruction forward. PEN America records classroom bans, including Central York, Pennsylvania, in 2021.',
    publishedDate: '2016',
    challenges: [
      {
        state: 'PA',
        jurisdictionLabel: 'Central York School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'rescinded',
        citation: {
          label: 'Pennsylvania school district reverses ban on books by authors of colour',
          href: 'https://www.theguardian.com/books/2021/sep/22/pennsylvania-school-district-reverses-ban-on-books-by-authors-of-colour',
          publisher: 'The Guardian',
          publishedAt: '2021-09-22',
        },
      },
    ],
    citations: [
      {
        label: "PEN America's Index of School Book Bans",
        href: 'https://docs.house.gov/meetings/GO/GO02/20220407/114616/HHRG-117-GO02-20220407-SD018.pdf',
        publisher: 'PEN America',
      },
      {
        label: 'White Rage: The Unspoken Truth of Our Racial Divide – Banned Books',
        href: 'https://www.banned-books.org/books/white-rage-the-unspoken-truth-of-our-racial-divide',
        publisher: 'Banned Books',
      },
      {
        label: 'Banned books by Carol Anderson — censorship history',
        href: 'https://www.banned-books.org/authors/carol-anderson',
        publisher: 'Banned Books',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781632864130'),
    provenance: provenance(
      'PEN America',
      'https://docs.house.gov/meetings/GO/GO02/20220407/114616/HHRG-117-GO02-20220407-SD018.pdf',
      'bb-book-white-rage',
      'White Rage: The Unspoken Truth of Our Racial Divide',
    ),
  },
  {
    id: 'bb-book-stamped-from-the-beginning',
    slug: 'stamped-from-the-beginning',
    title: 'Stamped from the Beginning: The Definitive History of Racist Ideas in America',
    authors: [{ name: 'Ibram X. Kendi', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781568584638' }],
    description:
      'Kendi’s National Book Award-winning history traces how racist ideas were built and spread through five American intellectual lives. It is distinct from the YA adaptation Stamped and appears on PEN America ban lists in Florida, Pennsylvania, and Texas.',
    publishedDate: '2016',
    challenges: [
      {
        state: 'TX',
        jurisdictionLabel: 'Klein Independent School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: 'Stamped from the beginning Banned in Klein Independent School District, TX',
          href: 'https://bannedindex.org/bans/33150',
          publisher: 'Banned Index',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Escambia County Public Schools',
        schoolYear: '2022-2023',
        challengeYear: 2022,
        status: 'reported',
        citation: {
          label: 'Stamped from the Beginning – Banned Books Week',
          href: 'https://researchguides.gonzaga.edu/BannedBooksWeek/StampedFromTheBeginning',
          publisher: 'Gonzaga University Libraries',
        },
      },
      {
        state: 'PA',
        jurisdictionLabel: 'Central York School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label:
            'Stamped from the Beginning: The Definitive History of Racist Ideas in America – Banned Books',
          href: 'https://www.banned-books.org/books/stamped-from-the-beginning-the-definitive-history-of-racist-ideas-in-america',
          publisher: 'Banned Books',
        },
      },
    ],
    citations: [
      {
        label: 'Stamped from the Beginning – Banned Books Week',
        href: 'https://researchguides.gonzaga.edu/BannedBooksWeek/StampedFromTheBeginning',
        publisher: 'Gonzaga University Libraries',
      },
      {
        label: 'Stamped from the beginning Banned in Klein Independent School District, TX',
        href: 'https://bannedindex.org/bans/33150',
        publisher: 'Banned Index',
      },
      {
        label:
          'Stamped from the Beginning: The Definitive History of Racist Ideas in America – Banned Books',
        href: 'https://www.banned-books.org/books/stamped-from-the-beginning-the-definitive-history-of-racist-ideas-in-america',
        publisher: 'Banned Books',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781568584638'),
    provenance: provenance(
      'PEN America',
      'https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/',
      'bb-book-stamped-from-the-beginning',
      'Stamped from the Beginning: The Definitive History of Racist Ideas in America',
    ),
  },
  {
    id: 'bb-book-on-the-come-up',
    slug: 'on-the-come-up',
    title: 'On the Come Up',
    authors: [{ name: 'Angie Thomas', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780062498564' }],
    description:
      'Sixteen-year-old Bri Jackson, an aspiring rapper in Garden Heights, fights to make a name for herself while her family faces eviction and her school labels her a troublemaker. A Printz Honor novel about poverty, art, and Black girl ambition.',
    publishedDate: '2019',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'St. Johns County School District',
        challengeYear: 2023,
        status: 'reported',
        citation: PEN_INDEX_2024,
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Lee County Schools',
        challengeYear: 2024,
        status: 'reported',
        citation: PEN_INDEX_2024,
      },
      {
        state: 'PA',
        jurisdictionLabel: 'Central York School District',
        challengeYear: 2021,
        status: 'rescinded',
        citation: {
          label: 'Pennsylvania school district reverses ban on books by authors of colour',
          href: 'https://www.theguardian.com/books/2021/sep/22/pennsylvania-school-district-reverses-ban-on-books-by-authors-of-colour',
          publisher: 'The Guardian',
          publishedAt: '2021-09-22',
        },
      },
    ],
    citations: [
      PEN_INDEX_2024,
      {
        label: 'On the Come Up censorship history (PEN America aggregates)',
        href: 'https://www.banned-books.org/books/on-the-come-up',
        publisher: 'Banned Books',
      },
      {
        label: 'Pennsylvania school district reverses ban on books by authors of colour',
        href: 'https://www.theguardian.com/books/2021/sep/22/pennsylvania-school-district-reverses-ban-on-books-by-authors-of-colour',
        publisher: 'The Guardian',
        publishedAt: '2021-09-22',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780062498564'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/',
      'bb-book-on-the-come-up',
      'On the Come Up',
    ),
  },
  {
    id: 'bb-book-black-boy-joy',
    slug: 'black-boy-joy',
    title: 'Black Boy Joy',
    authors: [{ name: 'Kwame Mbalia', role: 'editor' }],
    identifiers: [{ system: 'isbn-13', value: '9780593379936' }],
    description:
      'An anthology of seventeen stories, comics, and poems by Black authors celebrating Black boyhood — from first-day outfits and skateboarding to finding voice through hip-hop. Contributors include Jason Reynolds, Jerry Craft, and Varian Johnson.',
    publishedDate: '2021',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        schoolYear: '2022-2023',
        challengeYear: 2022,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2022-2023)",
          href: 'https://docs.google.com/spreadsheets/d/1a6v7R7pidO7TIwRZTIh9T6c0--QNNVufcUUrDcz2GJM/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label: 'PEN America Index of School Book Bans 2022–2023 (PDF)',
        href: 'https://thisbookisbanned.com/wp-content/uploads/2024/10/PEN-Americas-Index-of-School-Book-Bans-July-1-2022-June-30-2023-Sorted-by-State-District.pdf',
      },
      {
        label: 'Book Riot — Black Boy Joy among 2023 school bans',
        href: 'https://bookriot.com/they-may-not-be-the-most-targeted-but-theyre-still-banned/',
      },
      {
        label: "PEN America's Index of School Book Bans (2022-2023)",
        href: 'https://docs.google.com/spreadsheets/d/1a6v7R7pidO7TIwRZTIh9T6c0--QNNVufcUUrDcz2GJM/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780593379936'),
    provenance: provenance(
      'PEN America Index of School Book Bans 2022–2023',
      'https://thisbookisbanned.com/wp-content/uploads/2024/10/PEN-Americas-Index-of-School-Book-Bans-July-1-2022-June-30-2023-Sorted-by-State-District.pdf',
      'bb-book-black-boy-joy',
      'Black Boy Joy',
    ),
  },
  {
    id: 'bb-book-felix-ever-after',
    slug: 'felix-ever-after',
    title: 'Felix Ever After',
    authors: [{ name: 'Kacen Callender', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780062820259' }],
    description:
      'Felix Love, a Black transgender teen in Brooklyn, navigates identity, first love, and revenge after a classmate posts his deadname. A Stonewall Award-winning YA novel about self-discovery at a summer arts program.',
    publishedDate: '2020',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Hernando County School District',
        challengeYear: 2023,
        status: 'reported',
        citation: PEN_INDEX_2024,
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Volusia County School District',
        challengeYear: 2023,
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
      {
        state: 'TN',
        jurisdictionLabel: 'Wilson County Schools',
        challengeYear: 2024,
        status: 'reported',
        citation: {
          label: 'Nashville Banner — Wilson County bans include Felix Ever After',
          href: 'https://nashvillebanner.com/2024/10/25/wilson-county-bans-390-books/',
        },
      },
    ],
    citations: [
      PEN_INDEX_2024,
      PEN_INDEX_2023,
      {
        label: 'Nashville Banner — Wilson County bans include Felix Ever After',
        href: 'https://nashvillebanner.com/2024/10/25/wilson-county-bans-390-books/',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780062820259'),
    provenance: provenance(
      'PEN America Index of School Book Bans; Florida Department of Education reports',
      'https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/',
      'bb-book-felix-ever-after',
      'Felix Ever After',
    ),
  },
  {
    id: 'bb-book-clap-when-you-land',
    slug: 'clap-when-you-land',
    title: 'Clap When You Land',
    authors: [{ name: 'Elizabeth Acevedo', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780062882769' }],
    description:
      'Two half-sisters — Yahaira in New York and Camino in the Dominican Republic — learn of each other when their father dies in a plane crash. A novel in verse about grief, family secrets, and sisterhood across diaspora.',
    publishedDate: '2020',
    challenges: [
      {
        state: 'PA',
        jurisdictionLabel: 'Central York School District',
        challengeYear: 2021,
        status: 'rescinded',
        citation: PEN_INDEX_2022,
      },
      {
        state: 'UT',
        jurisdictionLabel: 'Nebo School District',
        challengeYear: 2022,
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Collier County Public Schools',
        challengeYear: 2024,
        status: 'reported',
        citation: PEN_INDEX_2024,
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Escambia County Public Schools',
        challengeYear: 2023,
        status: 'reported',
        citation: PEN_INDEX_2024,
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Shenandoah Community School District',
        challengeYear: 2024,
        status: 'reported',
        citation: PEN_INDEX_2024,
      },
    ],
    citations: [
      PEN_INDEX_2024,
      PEN_INDEX_2023,
      PEN_INDEX_2022,
      {
        label: 'Banned Books — Clap When You Land challenge records',
        href: 'https://www.banned-books.org/books/clap-when-you-land',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780062882769'),
    provenance: provenance(
      'PEN America Index of School Book Bans; ALA Office for Intellectual Freedom',
      'https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/',
      'bb-book-clap-when-you-land',
      'Clap When You Land',
    ),
  },
  {
    id: 'bb-book-tyler-johnson-was-here',
    slug: 'tyler-johnson-was-here',
    title: 'Tyler Johnson Was Here',
    authors: [{ name: 'Jay Coles', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780316472180' }],
    description:
      'After police kill his twin brother Tyler at a party, Marvin Johnson searches for answers while mourning a sibling who becomes a hashtag. A debut novel about police violence, grief, and what justice means for a college-bound Black teen.',
    publishedDate: '2018',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        challengeYear: 2024,
        status: 'reported',
        citation: PEN_INDEX_2024,
      },
    ],
    citations: [PEN_INDEX_2024, PEN_BOOK_BANS, NPR_ALA_2024],
    purchaseLinks: seedPurchaseLinks('9780316472180'),
    provenance: provenance(
      'PEN America Index of School Book Bans; Florida Department of Education annual reports',
      'https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/',
      'bb-book-tyler-johnson-was-here',
      'Tyler Johnson Was Here',
    ),
  },
  {
    id: 'bb-book-57-bus',
    slug: 'the-57-bus',
    title: 'The 57 Bus',
    authors: [{ name: 'Dashka Slater', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780374303235' }],
    description:
      'Nonfiction account of an Oakland hate-crime case: Sasha, an agender white teen, was set on fire on a city bus by Richard, a Black sixteen-year-old. Slater examines gender identity, juvenile justice, and restorative approaches to harm.',
    publishedDate: '2017',
    challenges: [
      {
        state: 'TN',
        jurisdictionLabel: 'Knox County Schools',
        challengeYear: 2024,
        status: 'reported',
        citation: {
          label: 'Knox News — Knox County Schools pulls 48 books including The 57 Bus',
          href: 'https://www.knoxnews.com/story/news/education/2024/12/05/knox-county-schools-pulls-48-books-in-accordance-with-tennessee-law/76770330007/',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Katy Independent School District',
        challengeYear: 2024,
        status: 'reported',
        citation: {
          label: 'PEN America Index of School Book Bans 2024–2025 (PDF)',
          href: 'https://www.dallasobserver.com/wp-content/uploads/sites/3/2025/01/PEN-America-Index-of-School-Book-Bans-%E2%80%93-2024-2025-PEN-America.pdf',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'School District of Manatee County',
        challengeYear: 2022,
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
    ],
    citations: [
      {
        label: 'Knox News — Knox County Schools pulls 48 books including The 57 Bus',
        href: 'https://www.knoxnews.com/story/news/education/2024/12/05/knox-county-schools-pulls-48-books-in-accordance-with-tennessee-law/76770330007/',
      },
      {
        label: 'Knox News — The 57 Bus author on school book ban',
        href: 'https://www.knoxnews.com/story/news/education/2025/01/21/the-57-bus-author-dashka-slater-school-book-ban-i-never-get-used-to-it/77048486007/',
      },
      {
        label: 'PEN America Index of School Book Bans 2023–2024',
        href: 'https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/',
      },
      {
        label: 'Artists at Risk Connection — Dashka Slater on nationwide bans',
        href: 'https://artistsatriskconnection.org/artist-voice/dashka-slater/',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780374303235'),
    provenance: provenance(
      'PEN America Index of School Book Bans; Knox News reporting',
      'https://www.knoxnews.com/story/news/education/2024/12/05/knox-county-schools-pulls-48-books-in-accordance-with-tennessee-law/76770330007/',
      'bb-book-57-bus',
      'The 57 Bus',
    ),
  },
  {
    id: 'bb-book-children-of-blood-and-bone',
    slug: 'children-of-blood-and-bone',
    title: 'Children of Blood and Bone',
    authors: [{ name: 'Tomi Adeyemi', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781250170972' }],
    description:
      'In the West African–inspired kingdom of Orïsha, Zélie fights to restore magic after a tyrant suppresses maji people. Adeyemi has said the fantasy trilogy responds to police violence against unarmed Black Americans and systemic oppression.',
    publishedDate: '2018',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Escambia County Public Schools',
        challengeYear: 2023,
        status: 'reported',
        citation: PEN_INDEX_2024,
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Katy Independent School District',
        challengeYear: 2022,
        status: 'reported',
        citation: PEN_INDEX_2022,
      },
    ],
    citations: [
      PEN_INDEX_2024,
      PEN_INDEX_2022,
      {
        label: 'PEN America v. Escambia County School District',
        href: 'https://pen.org/pen-america-v-escambia-county/',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781250170972'),
    provenance: provenance(
      'PEN America Index of School Book Bans; PEN America v. Escambia County litigation',
      'https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/',
      'bb-book-children-of-blood-and-bone',
      'Children of Blood and Bone',
    ),
  },
  {
    id: 'bb-book-roll-of-thunder-hear-my-cry',
    slug: 'roll-of-thunder-hear-my-cry',
    title: 'Roll of Thunder, Hear My Cry',
    authors: [{ name: 'Mildred D. Taylor', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780803774735' }],
    description:
      'Cassie Logan and her Mississippi family hold their land during the Depression as night riders, boycotts, and school segregation close in. Taylor drew on family stories; the novel won the 1977 Newbery Medal.',
    publishedDate: '1976',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'The School District of Palm Beach County',
        schoolYear: '2022-2023',
        challengeYear: 2022,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2022-2023)",
          href: 'https://docs.google.com/spreadsheets/d/1a6v7R7pidO7TIwRZTIh9T6c0--QNNVufcUUrDcz2GJM/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label: "PEN America's Index of School Book Bans (2022-2023)",
        href: 'https://docs.google.com/spreadsheets/d/1a6v7R7pidO7TIwRZTIh9T6c0--QNNVufcUUrDcz2GJM/edit',
        publisher: 'PEN America',
      },
      {
        label: 'Roll of Thunder, Hear My Cry — ALA Top 10 Most Challenged Books of 2023',
        href: 'https://www.ala.org/bbooks/frequentlychallengedbooks/top10',
        publisher: 'American Library Association',
        publishedAt: '2024',
      },
      {
        label: 'Banned Books Week 2013: Mildred Taylor — Ohioana Library',
        href: 'https://www.ohioana.org/banned-books-week-2013-mildred-taylor/',
        publisher: 'Ohioana Library Association',
        publishedAt: '2013',
      },
      {
        label: 'Roll of Thunder, Hear My Cry — Banned Books Week (Gonzaga University)',
        href: 'https://researchguides.gonzaga.edu/BannedBooksWeek/RollOfThunderHearMyCry',
        publisher: 'Gonzaga University Libraries',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780803774735'),
    provenance: provenance(
      'American Library Association Office for Intellectual Freedom',
      'https://www.ala.org/bbooks/frequentlychallengedbooks/top10',
      'bb-book-roll-of-thunder-hear-my-cry',
      'Roll of Thunder, Hear My Cry',
    ),
  },
  {
    id: 'bb-book-song-of-solomon',
    slug: 'song-of-solomon',
    title: 'Song of Solomon',
    authors: [{ name: 'Toni Morrison', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780586049815' }],
    description:
      'An African American man searches for identity and meaning across generations, tracing his family history and discovering truths about love, freedom, and self-discovery through magical realism and cultural heritage.',
    publishedDate: '1977',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Collier County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Escambia County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Orange County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Volusia County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Ankeny Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Cardinal Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Clarinda Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Grundy Center Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Indianola Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Linn-Mar Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Northwood Kensett Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Roland-Story Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Shenandoah Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'South Hamilton Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Urbandale Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'West Burlington Independent School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'VA',
        jurisdictionLabel: 'Spotsylvania County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Clay County School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Collier County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Escambia County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Orange County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Volusia County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Ankeny Community School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780586049815'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-song-of-solomon',
      'Song of Solomon',
    ),
  },
  {
    id: 'bb-book-the-black-flamingo',
    slug: 'the-black-flamingo',
    title: 'The Black Flamingo',
    authors: [{ name: 'Dean Atta', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780062990297' }],
    description:
      'A coming-of-age novel following a Black British Caribbean teenager navigating identity, sexuality, and belonging while finding confidence and voice through drag performance and self-expression.',
    publishedDate: '2019',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Indian River County School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TN',
        jurisdictionLabel: 'Collierville Schools',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'North East Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Escambia County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Flagler Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Okaloosa County School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'GA',
        jurisdictionLabel: 'Cobb County School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Clear Creek-Amana Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'SC',
        jurisdictionLabel: 'Spartanburg County School District One',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Conroe Independent School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — Indian River County School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2021-2022) — Collierville Schools",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — North East Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Escambia County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Flagler Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Okaloosa County School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780062990297'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-the-black-flamingo',
      'The Black Flamingo',
    ),
  },
  {
    id: 'bb-book-little-and-lion',
    slug: 'little-and-lion',
    title: 'Little and Lion',
    authors: [{ name: 'Brandy Colbert', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780316348980' }],
    description:
      'A young girl reunites with her brother at boarding school and discovers he is struggling with his sexuality and self-acceptance, leading her to navigate family secrets and her own growing awareness.',
    publishedDate: '2017',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Escambia County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Hernando County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Lee County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Martin County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'VA',
        jurisdictionLabel: 'Spotsylvania County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'WI',
        jurisdictionLabel: 'Elkhorn Area School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Indian River County School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TN',
        jurisdictionLabel: 'Collierville Schools',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'North East Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Escambia County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Hernando County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Lee County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Martin County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Spotsylvania County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Elkhorn Area School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780316348980'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-little-and-lion',
      'Little and Lion',
    ),
  },
  {
    id: 'bb-book-darkness-before-dawn',
    slug: 'darkness-before-dawn',
    title: 'Darkness Before Dawn',
    authors: [{ name: 'Sharon M. Draper', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781442489158' }],
    description:
      "A young man navigates life after his best friend's suicide in this sequel to Tears of a Tiger, exploring grief, mental health, and finding reasons to continue living.",
    publishedDate: '2001',
    challenges: [
      {
        state: 'NC',
        jurisdictionLabel: 'Pitt County Schools',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Escambia County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Lake County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Lee County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'North East Independent School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label: "PEN America's Index of School Book Bans (2021-2022) — Pitt County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Escambia County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Lake County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Lee County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — North East Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781442489158'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-darkness-before-dawn',
      'Darkness Before Dawn',
    ),
  },
  {
    id: 'bb-book-this-book-is-anti-racist',
    slug: 'this-book-is-anti-racist',
    title: 'This Book Is Anti-Racist: 20 Lessons on How to Wake Up, Take Action, and Do the Work',
    authors: [{ name: 'Tiffany Jewell', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781665036894' }],
    description:
      'An educational guide providing twenty lessons to help young readers understand racism, examine their own biases, and take meaningful action against systemic and individual racism.',
    publishedDate: '2020',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Indian River County School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'PA',
        jurisdictionLabel: 'Central York School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TN',
        jurisdictionLabel: 'Collierville Schools',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'North East Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — Indian River County School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2021-2022) — Central York School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2021-2022) — Collierville Schools",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — North East Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781665036894'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-this-book-is-anti-racist',
      'This Book Is Anti-Racist: 20 Lessons on How to Wake Up, Take Action, and Do the Work',
    ),
  },
  {
    id: 'bb-book-the-new-jim-crow',
    slug: 'the-new-jim-crow',
    title: 'The New Jim Crow: Mass Incarceration in the Age of Colorblindness',
    authors: [{ name: 'Michelle Alexander', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781595581037' }],
    description:
      'A critical examination of mass incarceration in the United States, arguing that the criminal justice system functions as a racial caste system that perpetuates inequality despite claims of colorblindness.',
    publishedDate: '2010',
    challenges: [
      {
        state: 'PA',
        jurisdictionLabel: 'Central York School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Klein Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'North East Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label: "PEN America's Index of School Book Bans (2021-2022) — Central York School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — Klein Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — North East Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781595581037'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-the-new-jim-crow',
      'The New Jim Crow: Mass Incarceration in the Age of Colorblindness',
    ),
  },
  {
    id: 'bb-book-the-revolution-of-birdie-randolph',
    slug: 'the-revolution-of-birdie-randolph',
    title: 'The Revolution of Birdie Randolph',
    authors: [{ name: 'Brandy Colbert', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780316448567' }],
    description:
      'A young Black girl discovers her voice and purpose when she becomes involved in activism and social justice, learning about community, leadership, and making a difference.',
    publishedDate: '2019',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Escambia County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Lee County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Nevada Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Escambia County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Lee County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Nevada Community School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780316448567'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-the-revolution-of-birdie-randolph',
      'The Revolution of Birdie Randolph',
    ),
  },
  {
    id: 'bb-book-grown',
    slug: 'grown',
    title: 'Grown',
    authors: [{ name: 'Tiffany D. Jackson', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9798855062311' }],
    description:
      'When legendary R&B artist Korey Fields spots aspiring singer Enchanted Jones, her dreams of fame take flight. But Enchanted wakes with blood on her hands and no memory of the previous night. As Korey is found dead, Enchanted discovers that behind his charm was a dark, controlling side.',
    publishedDate: '2020',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Collier County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Lake County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Lee County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Seminole County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Ankeny Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Cedar Falls Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Clear Lake Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Council Bluffs Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Dallas Center-Grimes Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Grundy Center Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Iowa City Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'MO',
        jurisdictionLabel: 'Cameron R-1 School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'SC',
        jurisdictionLabel: 'Spartanburg County School District One',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Conroe Independent School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Fort Worth Independent School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'VA',
        jurisdictionLabel: 'Hanover County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'WI',
        jurisdictionLabel: 'Elkhorn Area School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Collier County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Lake County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Lee County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Seminole County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Ankeny Community School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Cedar Falls Community School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9798855062311'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-grown',
      'Grown',
    ),
  },
  {
    id: 'bb-book-black-girl-unlimited-the-remarkable-story-of-a-teenage-wizard',
    slug: 'black-girl-unlimited-the-remarkable-story-of-a-teenage-wizard',
    title: 'Black Girl Unlimited: The Remarkable Story of a Teenage Wizard',
    authors: [{ name: 'Echo Brown', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9798855016635' }],
    description:
      'Explores the intersections of poverty, sexual violence, depression, racism, and sexism through the arc of a transcendent coming-of-age story about Black identity and resilience.',
    publishedDate: '2020',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Indian River County School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'KS',
        jurisdictionLabel: 'Goddard Public Schools',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'MO',
        jurisdictionLabel: 'Nixa Public Schools',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Escambia County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Seminole County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Cedar Falls Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Council Bluffs Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Iowa City Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Waterloo Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — Indian River County School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2021-2022) — Goddard Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2021-2022) — Nixa Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Clay County School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Escambia County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Seminole County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9798855016635'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-black-girl-unlimited-the-remarkable-story-of-a-teenage-wizard',
      'Black Girl Unlimited: The Remarkable Story of a Teenage Wizard',
    ),
  },
  {
    id: 'bb-book-class-act',
    slug: 'class-act',
    title: 'Class Act',
    authors: [{ name: 'Jerry Craft', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780063032064' }],
    description:
      "Eighth grader Drew Ellis recognizes that he isn't afforded the same opportunities as his privileged classmates at Riverdale Academy Day School, and struggles with whether his friend Liam shares similar advantages.",
    publishedDate: '2020',
    challenges: [
      {
        state: 'TX',
        jurisdictionLabel: 'Granbury Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Katy Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'North East Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Lee County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Alta-Aurelia Community Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Pocahontas Area Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'WI',
        jurisdictionLabel: 'Elkhorn Area School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — Granbury Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — Katy Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — North East Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Lee County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Alta-Aurelia Community Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Pocahontas Area Community School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780063032064'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-class-act',
      'Class Act',
    ),
  },
  {
    id: 'bb-book-when-i-was-the-greatest',
    slug: 'when-i-was-the-greatest',
    title: 'When I Was the Greatest',
    authors: [{ name: 'Jason Reynolds', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781442459489' }],
    description:
      'Sixteen-year-old Ali lives in a Brooklyn neighborhood known for guns and drugs, where he manages to stay out of trouble until he and his friends attend the wrong party, after which one is badly hurt and another becomes a target.',
    publishedDate: '2014',
    challenges: [
      {
        state: 'NC',
        jurisdictionLabel: 'Pender County Schools',
        schoolYear: '2022-2023',
        challengeYear: 2022,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2022-2023)",
          href: 'https://docs.google.com/spreadsheets/d/1a6v7R7pidO7TIwRZTIh9T6c0--QNNVufcUUrDcz2GJM/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        schoolYear: '2022-2023',
        challengeYear: 2022,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2022-2023)",
          href: 'https://docs.google.com/spreadsheets/d/1a6v7R7pidO7TIwRZTIh9T6c0--QNNVufcUUrDcz2GJM/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Bay District Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Escambia County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'WI',
        jurisdictionLabel: 'Elkhorn Area School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label: "PEN America's Index of School Book Bans (2022-2023) — Pender County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1a6v7R7pidO7TIwRZTIh9T6c0--QNNVufcUUrDcz2GJM/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2022-2023) — Clay County School District",
        href: 'https://docs.google.com/spreadsheets/d/1a6v7R7pidO7TIwRZTIh9T6c0--QNNVufcUUrDcz2GJM/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Bay District Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Escambia County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Elkhorn Area School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781442459489'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-when-i-was-the-greatest',
      'When I Was the Greatest',
    ),
  },
  {
    id: 'bb-book-red-at-the-bone',
    slug: 'red-at-the-bone',
    title: 'Red at the Bone',
    authors: [{ name: 'Jacqueline Woodson', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781474617048' }],
    description:
      'A novel exploring intergenerational connections within a Black family, told through interconnected narratives that span decades and examine identity, family relationships, and personal growth.',
    publishedDate: '2019',
    challenges: [
      {
        state: 'TX',
        jurisdictionLabel: 'Leander Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'North East Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Seminole County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Conroe Independent School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — Leander Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — North East Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Seminole County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Conroe Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781474617048'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-red-at-the-bone',
      'Red at the Bone',
    ),
  },
  {
    id: 'bb-book-american-street',
    slug: 'american-street',
    title: 'American Street',
    authors: [{ name: 'Ibi Zoboi', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781536438871' }],
    description:
      'After immigrating from Haiti, Fabiola Toussaint navigates her new life in Detroit—loud American cousins, a new school, and a surprising romance—while her mother is detained by U.S. immigration, leaving her facing an impossible choice.',
    publishedDate: '2017',
    challenges: [
      {
        state: 'PA',
        jurisdictionLabel: 'Pennridge School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Collier County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label: "PEN America's Index of School Book Bans (2021-2022) — Pennridge School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Clay County School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Collier County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781536438871'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-american-street',
      'American Street',
    ),
  },
  {
    id: 'bb-book-stamped-for-kids-racism-antiracism-and-you',
    slug: 'stamped-for-kids-racism-antiracism-and-you',
    title: 'Stamped (For Kids): Racism, Antiracism, and You',
    authors: [{ name: 'Jason Reynolds', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780316167581' }],
    description:
      'An adaptation for young readers that traces the history of racist ideas and antiracist resistance in America, presenting complex concepts about racism and the pursuit of equality in accessible language.',
    publishedDate: '2021',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Hernando County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Adel DeSoto Minburn Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'PA',
        jurisdictionLabel: 'Blackhawk School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Hernando County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Adel DeSoto Minburn Community School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Blackhawk School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780316167581'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-stamped-for-kids-racism-antiracism-and-you',
      'Stamped (For Kids): Racism, Antiracism, and You',
    ),
  },
  {
    id: 'bb-book-concrete-rose',
    slug: 'concrete-rose',
    title: 'Concrete Rose',
    authors: [{ name: 'Angie Thomas', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780062846723' }],
    description:
      'A prequel to The Hate U Give, this novel follows Maverick Carter, a sixteen-year-old Black teen navigating fatherhood, gang involvement, and survival in a systemic struggle while trying to become a better man for his newborn son.',
    publishedDate: '2021',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Lake County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Orange County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Santa Rosa County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'School District of Manatee County',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Seminole County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Volusia County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Clear Creek-Amana Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Clear Lake Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Grundy Center Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Ridge View Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Solon Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'WACO Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'WI',
        jurisdictionLabel: 'Elkhorn Area School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Lake County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Orange County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Santa Rosa County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — School District of Manatee County",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Seminole County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Volusia County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780062846723'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-concrete-rose',
      'Concrete Rose',
    ),
  },
  {
    id: 'bb-book-allegedly',
    slug: 'allegedly',
    title: 'Allegedly',
    authors: [{ name: 'Tiffany D. Jackson', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780062422644' }],
    description:
      'A psychological thriller about Mary, a teen in a group home who becomes pregnant, sparking a reexamination of the crime she was convicted for at age nine and the truth behind her traumatic past.',
    publishedDate: '2017',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Brevard Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Lake County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Lee County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Santa Rosa County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Seminole County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Ridge View Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'SC',
        jurisdictionLabel: 'Spartanburg County School District One',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Conroe Independent School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Fort Worth Independent School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'WI',
        jurisdictionLabel: 'Elkhorn Area School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Brevard Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Lake County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Lee County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Santa Rosa County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Seminole County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Ridge View Community School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780062422644'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-allegedly',
      'Allegedly',
    ),
  },
  {
    id: 'bb-book-new-kid',
    slug: 'new-kid',
    title: 'New Kid',
    authors: [{ name: 'Jerry Craft', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780062691194' }],
    description:
      'A Newbery and Caldecott award-winning graphic novel about Jordan Banks, a seventh-grade aspiring cartoonist navigating elite private school while balancing his Washington Heights neighborhood roots and racial identity as one of the few students of color.',
    publishedDate: '2019',
    challenges: [
      {
        state: 'PA',
        jurisdictionLabel: 'Central York School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Granbury Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Katy Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'North East Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Lee County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Alta-Aurelia Community Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'WI',
        jurisdictionLabel: 'Elkhorn Area School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label: "PEN America's Index of School Book Bans (2021-2022) — Central York School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — Granbury Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — Katy Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — North East Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Lee County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Alta-Aurelia Community Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780062691194'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-new-kid',
      'New Kid',
    ),
  },
  {
    id: 'bb-book-with-the-fire-on-high',
    slug: 'with-the-fire-on-high',
    title: 'With the Fire on High',
    authors: [{ name: 'Elizabeth Acevedo', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780062662835' }],
    description:
      'A coming-of-age novel in verse about an emancipated teen mother with an extraordinary gift for cooking who dreams of opening her own restaurant while navigating motherhood, school, and her complex relationship with her family.',
    publishedDate: '2019',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Escambia County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Orange County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Linn-Mar Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Sioux Center Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Clay County School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Escambia County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Orange County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Linn-Mar Community School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Sioux Center Community School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780062662835'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-with-the-fire-on-high',
      'With the Fire on High',
    ),
  },
  {
    id: 'bb-book-uncomfortable-conversations-with-a-black-boy',
    slug: 'uncomfortable-conversations-with-a-black-boy',
    title: 'Uncomfortable Conversations with a Black Boy',
    authors: [{ name: 'Emmanuel Acho', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781250866103' }],
    description:
      'A non-fiction dialogue guide designed for children and adults to discuss race, racism, and systemic inequality through 20 conversations that explore topics like identity, microaggressions, and allyship.',
    publishedDate: '2021',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        schoolYear: '2022-2023',
        challengeYear: 2022,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2022-2023)",
          href: 'https://docs.google.com/spreadsheets/d/1a6v7R7pidO7TIwRZTIh9T6c0--QNNVufcUUrDcz2GJM/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Escambia County Public Schools',
        schoolYear: '2022-2023',
        challengeYear: 2022,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2022-2023)",
          href: 'https://docs.google.com/spreadsheets/d/1a6v7R7pidO7TIwRZTIh9T6c0--QNNVufcUUrDcz2GJM/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Okaloosa County School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'GA',
        jurisdictionLabel: 'Cobb County School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label: "PEN America's Index of School Book Bans (2022-2023) — Clay County School District",
        href: 'https://docs.google.com/spreadsheets/d/1a6v7R7pidO7TIwRZTIh9T6c0--QNNVufcUUrDcz2GJM/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2022-2023) — Escambia County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1a6v7R7pidO7TIwRZTIh9T6c0--QNNVufcUUrDcz2GJM/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Okaloosa County School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Cobb County School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781250866103'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-uncomfortable-conversations-with-a-black-boy',
      'Uncomfortable Conversations with a Black Boy',
    ),
  },
  {
    id: 'bb-book-copper-sun',
    slug: 'copper-sun',
    title: 'Copper Sun',
    authors: [{ name: 'Sharon M. Draper', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781416953487' }],
    description:
      'A historical novel set in the American South that follows the parallel stories of a young African girl sold into slavery and an indentured servant girl, exploring their friendship and struggle for freedom.',
    publishedDate: '2006',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Collier County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Escambia County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: "St. John's County School District",
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Collier County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Escambia County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — St. John's County School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781416953487'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-copper-sun',
      'Copper Sun',
    ),
  },
  {
    id: 'bb-book-the-weight-of-blood',
    slug: 'the-weight-of-blood',
    title: 'The Weight of Blood',
    authors: [{ name: 'Tiffany D. Jackson', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780063029156' }],
    description:
      'A young adult mystery novel about a girl found dead in a frozen lake, exploring themes of identity, belonging, and small-town secrets as her close friends investigate the circumstances of her death.',
    publishedDate: '2022',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Lee County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Lake Mills Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Nevada Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN america's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Lee County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Lake Mills Community School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Nevada Community School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780063029156'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-the-weight-of-blood',
      'The Weight of Blood',
    ),
  },
  {
    id: 'bb-book-half-of-a-yellow-sun',
    slug: 'half-of-a-yellow-sun',
    title: 'Half of a Yellow Sun',
    authors: [{ name: 'Chimamanda Ngozi Adichie', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781400044160' }],
    description:
      'A sweeping narrative spanning 1960s Nigeria during the Biafran War, following three interconnected lives—a wealthy married woman, her houseboy, and a radical young man—as they navigate love, loyalty, and survival amid political upheaval.',
    publishedDate: '2006',
    challenges: [
      {
        state: 'MI',
        jurisdictionLabel: 'Hudsonville Public Schools',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Duval County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Lee County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Orange County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Polk County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: "St. John's County School District",
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'West Des Moines Community Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'MD',
        jurisdictionLabel: 'Caroll County School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Conroe Independent School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Plano Independent School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'VA',
        jurisdictionLabel: 'Hanover County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label: "PEN America's Index of School Book Bans (2021-2022) — Hudsonville Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Duval County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Lee County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Orange County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Polk County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — St. John's County School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781400044160'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-half-of-a-yellow-sun',
      'Half of a Yellow Sun',
    ),
  },
  {
    id: 'bb-book-blended',
    slug: 'blended',
    title: 'Blended',
    authors: [{ name: 'Sharon M. Draper', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781442495005' }],
    description:
      "A teenage girl navigates life between her divorced parents' homes and the complications of being multiracial, exploring identity, belonging, and family dynamics.",
    publishedDate: '2018',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Indian River County School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'KS',
        jurisdictionLabel: 'Goddard Public Schools',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TN',
        jurisdictionLabel: 'Hamilton County Schools',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Clear Creek Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Martin County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: "St. John's County School District",
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Spencer Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Spirit Lake Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'WI',
        jurisdictionLabel: 'Elkhorn Area School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — Indian River County School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2021-2022) — Goddard Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2021-2022) — Hamilton County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — Clear Creek Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Martin County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — St. John's County School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781442495005'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-blended',
      'Blended',
    ),
  },
  {
    id: 'bb-book-odd-one-out',
    slug: 'odd-one-out',
    title: 'Odd One Out',
    authors: [{ name: 'Nic Stone', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781101939536' }],
    description:
      'A sixteen-year-old deaf girl navigates high school experiences, personal identity, and connections with her hearing and deaf communities.',
    publishedDate: '2018',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Indian River County School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'Granbury Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'TX',
        jurisdictionLabel: 'North East Independent School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Clay County School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Nevada Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'KY',
        jurisdictionLabel: 'Boyle County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'VA',
        jurisdictionLabel: 'Spotsylvania County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — Indian River County School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — Granbury Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — North East Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Clay County School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Nevada Community School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Boyle County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781101939536'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-odd-one-out',
      'Odd One Out',
    ),
  },
  {
    id: 'bb-book-the-black-friend-on-being-a-better-white-person',
    slug: 'the-black-friend-on-being-a-better-white-person',
    title: 'The Black Friend: On Being a Better White Person',
    authors: [{ name: 'Frederick Joseph', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781529500615' }],
    description:
      'A guide exploring race relations and antiracism for white readers, offering personal essays and practical strategies for becoming a more attentive and accountable ally.',
    publishedDate: '2021',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Indian River County School District',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'MS',
        jurisdictionLabel: 'Madison County Schools',
        schoolYear: '2021-2022',
        challengeYear: 2021,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2021-2022)",
          href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Hernando County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Martin County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label:
          "PEN America's Index of School Book Bans (2021-2022) — Indian River County School District",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2021-2022) — Madison County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Hernando County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Martin County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781529500615'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-the-black-friend-on-being-a-better-white-person',
      'The Black Friend: On Being a Better White Person',
    ),
  },
  {
    id: 'bb-book-kaffir-boy-an-autobiography',
    slug: 'kaffir-boy-an-autobiography',
    title:
      "Kaffir Boy: An Autobiography - The True Story of a Black Youth's Coming of Age in Apartheid South Africa",
    authors: [{ name: 'Mark Mathabane', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9781558000940' }],
    description:
      "A memoir recounting the author's childhood in apartheid South Africa, detailing his experiences as a young Black man navigating systemic racism, poverty, and his path to tennis and eventual escape from the country.",
    publishedDate: '1986',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Broward County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'restricted',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Indian River County Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'FL',
        jurisdictionLabel: 'Seminole County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Winterset Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Broward County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label: "PEN America's Index of School Book Bans (2023-2024) — Indian River County Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Seminole County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Winterset Community School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9781558000940'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-kaffir-boy-an-autobiography',
      "Kaffir Boy: An Autobiography - The True Story of a Black Youth's Coming of Age in Apartheid South Africa",
    ),
  },
  {
    id: 'bb-book-go-tell-it-on-the-mountain',
    slug: 'go-tell-it-on-the-mountain',
    title: 'Go Tell It on the Mountain',
    authors: [{ name: 'James Baldwin', role: 'author' }],
    identifiers: [{ system: 'isbn-13', value: '9780140184501' }],
    description:
      "A novel set in 1930s Harlem following a fourteen-year-old boy's spiritual awakening within a Pentecostal church community, exploring family trauma, religious experience, and identity.",
    publishedDate: '1952',
    challenges: [
      {
        state: 'FL',
        jurisdictionLabel: 'Escambia County Public Schools',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'reported',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'Shenandoah Community School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
      {
        state: 'IA',
        jurisdictionLabel: 'West Burlington Independent School District',
        schoolYear: '2023-2024',
        challengeYear: 2023,
        status: 'banned',
        citation: {
          label: "PEN America's Index of School Book Bans (2023-2024)",
          href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
          publisher: 'PEN America',
        },
      },
    ],
    citations: [
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Escambia County Public Schools",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — Shenandoah Community School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
      {
        label:
          "PEN America's Index of School Book Bans (2023-2024) — West Burlington Independent School District",
        href: 'https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/edit',
        publisher: 'PEN America',
      },
    ],
    purchaseLinks: seedPurchaseLinks('9780140184501'),
    provenance: provenance(
      'PEN America Index of School Book Bans',
      'https://pen.org/book-bans/pen-america-book-ban-index-data/',
      'bb-book-go-tell-it-on-the-mountain',
      'Go Tell It on the Mountain',
    ),
  },
];

for (const book of RAW_BOOKS) {
  assertBannedBookRecord(book);
}

const BOOKS_BY_SLUG = new Map(RAW_BOOKS.map((book) => [book.slug, book]));

export function listBannedBookRecords(): readonly BannedBookRecord[] {
  return RAW_BOOKS;
}

export function getBannedBookBySlug(slug: string): BannedBookRecord | undefined {
  return BOOKS_BY_SLUG.get(slug);
}

export function getBannedBooksListingSnapshot(): BannedBooksListingSnapshot {
  return {
    version: BANNED_BOOKS_SEED_VERSION,
    generatedAt: RETRIEVED_AT,
    books: RAW_BOOKS,
  };
}
