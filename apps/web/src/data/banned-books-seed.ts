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

export const BANNED_BOOKS_SEED_VERSION = '2026-07-21.1';

function seedPurchaseLinks(isbn13: string) {
  return buildIsbnPurchaseLinks(isbn13, { bookshopAffiliateId: BOOKSHOP_AFFILIATE_ID });
}

const RETRIEVED_AT = '2026-07-21T12:00:00.000Z';

const ALA_TOP10: BannedBookCitation = {
  label: 'ALA Top 10 Most Challenged Books',
  href: 'https://www.ala.org/advocacy/bbooks/frequentlychallengedbooks/top10',
  publisher: 'American Library Association',
};

const ALA_2024_NEWS: BannedBookCitation = {
  label: 'ALA Top 10 Most Challenged Books of 2024',
  href: 'https://www.ala.org/news/2025/04/american-library-association-kicks-national-library-week-top-10-most-challenged-books',
  publisher: 'American Library Association',
  publishedAt: '2025-04',
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
    provenance: provenance('American Library Association', ALA_TOP10.href, 'bb-book-bluest-eye', 'The Bluest Eye'),
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
    provenance: provenance('PEN America', PEN_BOOK_BANS.href, 'bb-book-hate-u-give', 'The Hate U Give'),
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
    provenance: provenance('PEN America', PEN_INDEX_2023.href, 'bb-book-stamped', 'Stamped: Racism, Antiracism, and You'),
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
    provenance: provenance('PEN America', PEN_INDEX_2023.href, 'bb-book-between-world-and-me', 'Between the World and Me'),
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
    provenance: provenance('American Library Association', ALA_TOP10.href, 'bb-book-caged-bird', 'I Know Why the Caged Bird Sings'),
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
    provenance: provenance('American Library Association', ALA_TOP10.href, 'bb-book-color-purple', 'The Color Purple'),
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
    provenance: provenance('PEN America', PEN_INDEX_DATA.href, 'bb-book-how-to-be-antiracist', 'How to Be an Antiracist'),
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
        state: 'NC',
        status: 'reported',
        citation: ALA_TOP10,
      },
      {
        state: 'WA',
        status: 'reported',
        citation: PEN_INDEX_2023,
      },
    ],
    citations: [ALA_TOP10, PEN_BOOK_BANS, NPR_ALA_2024],
    purchaseLinks: seedPurchaseLinks('9780679732761'),
    provenance: provenance('American Library Association', ALA_TOP10.href, 'bb-book-invisible-man', 'Invisible Man'),
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
    provenance: provenance('American Library Association', ALA_TOP10.href, 'bb-book-native-son', 'Native Son'),
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
