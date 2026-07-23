/**
 * Merges banned-books-research/*.json into validated BannedBookRecord objects and prints
 * TypeScript literal blocks for apps/web/src/data/banned-books-seed.ts.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertBannedBookRecord, buildIsbnPurchaseLinks } from '@repo/domain';

const __dirname = dirname(fileURLToPath(import.meta.url));
const researchDir = join(__dirname, '../src/data/banned-books-research');
const RETRIEVED_AT = '2026-07-21T12:00:00.000Z';
const BOOKSHOP_AFFILIATE_ID = 'gerald69';

const EXISTING_SLUGS = new Set([
  'the-bluest-eye',
  'beloved',
  'the-hate-u-give',
  'stamped-racism-antiracism-and-you',
  'between-the-world-and-me',
  'i-know-why-the-caged-bird-sings',
  'the-color-purple',
  'how-to-be-an-antiracist',
  'invisible-man',
  'native-son',
]);

const CITATION_ALIASES = new Map([
  ['https://www.ala.org/advocacy/bbooks/frequentlychallengedbooks/top10', 'ALA_TOP10'],
  [
    'https://www.ala.org/news/2025/04/american-library-association-kicks-national-library-week-top-10-most-challenged-books',
    'ALA_2024_NEWS',
  ],
  ['https://pen.org/book-bans/', 'PEN_BOOK_BANS'],
  ['https://pen.org/book-bans/2023-banned-book-list/', 'PEN_INDEX_2023'],
  ['https://pen.org/book-bans/pen-america-book-ban-index-data/', 'PEN_INDEX_DATA'],
  ['https://www.npr.org/2023/09/21/1200725104/book-bans-school-pen-america', 'NPR_PEN_2023'],
  [
    'https://www.npr.org/2024/03/14/1238647724/the-number-of-book-titles-that-people-tried-to-ban-rose-by-65-last-year',
    'NPR_ALA_2024',
  ],
]);

function seedContentHash(id, title) {
  return createHash('sha256').update(`${id}${title}`).digest('hex');
}

function bookId(slug) {
  const base = slug.replace(/^the-/, '');
  return `bb-book-${base.length > 40 ? base.slice(0, 40).replace(/-$/, '') : base}`;
}

function formatCitation(citation) {
  const alias = CITATION_ALIASES.get(citation.href);
  if (alias) return alias;
  const parts = [`label: ${JSON.stringify(citation.label)}`, `href: ${JSON.stringify(citation.href)}`];
  if (citation.publisher) parts.push(`publisher: ${JSON.stringify(citation.publisher)}`);
  if (citation.publishedAt) parts.push(`publishedAt: ${JSON.stringify(citation.publishedAt)}`);
  return `{ ${parts.join(', ')} }`;
}

function formatAuthors(authors) {
  return `[${authors.map((a) => `{ name: ${JSON.stringify(a.name)}, role: '${a.role ?? 'author'}' }`).join(', ')}]`;
}

function formatChallenges(challenges) {
  return `[${challenges
    .map((c) => {
      const parts = [
        `state: '${c.state}'`,
        `status: '${c.status ?? 'reported'}'`,
        `citation: ${formatCitation(c.citation)}`,
      ];
      if (c.jurisdictionLabel) parts.splice(1, 0, `jurisdictionLabel: ${JSON.stringify(c.jurisdictionLabel)}`);
      if (c.schoolYear) parts.splice(c.jurisdictionLabel ? 2 : 1, 0, `schoolYear: ${JSON.stringify(c.schoolYear)}`);
      if (c.challengeYear) parts.push(`challengeYear: ${c.challengeYear}`);
      return `{ ${parts.join(', ')} }`;
    })
    .join(', ')}]`;
}

function toRecord(raw) {
  const id = bookId(raw.slug);
  const purchaseLinks = buildIsbnPurchaseLinks(raw.isbn13, { bookshopAffiliateId: BOOKSHOP_AFFILIATE_ID });
  return {
    id,
    slug: raw.slug,
    title: raw.title,
    authors: raw.authors.map((a) => ({ name: a.name, ...(a.role ? { role: a.role } : {}) })),
    identifiers: [{ system: 'isbn-13', value: raw.isbn13 }],
    description: raw.description,
    publishedDate: raw.publishedDate,
    challenges: raw.challenges.map((c) => ({
      state: c.state,
      ...(c.jurisdictionLabel ? { jurisdictionLabel: c.jurisdictionLabel } : {}),
      ...(c.schoolYear ? { schoolYear: c.schoolYear } : {}),
      ...(c.challengeYear ? { challengeYear: c.challengeYear } : {}),
      status: c.status ?? 'reported',
      citation: c.citation,
    })),
    citations: raw.citations,
    purchaseLinks,
    provenance: {
      source: raw.provenance.source,
      sourceUrl: raw.provenance.sourceUrl,
      retrievedAt: RETRIEVED_AT,
      contentHash: seedContentHash(id, raw.title),
    },
  };
}

function formatRecord(record) {
  const citations = record.citations.map(formatCitation).join(', ');
  return `  {
    id: '${record.id}',
    slug: '${record.slug}',
    title: ${JSON.stringify(record.title)},
    authors: ${formatAuthors(record.authors)},
    identifiers: [{ system: 'isbn-13', value: '${record.identifiers[0].value}' }],
    description:
      ${JSON.stringify(record.description)},
    publishedDate: '${record.publishedDate}',
    challenges: ${formatChallenges(record.challenges)},
    citations: [${citations}],
    purchaseLinks: seedPurchaseLinks('${record.identifiers[0].value}'),
    provenance: provenance(${JSON.stringify(record.provenance.source)}, ${JSON.stringify(record.provenance.sourceUrl)}, '${record.id}', ${JSON.stringify(record.title)}),
  }`;
}

const files = readdirSync(researchDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

const seenSlugs = new Set();
const seenIsbns = new Set();
const records = [];
const skipped = [];

for (const file of files) {
  const items = JSON.parse(readFileSync(join(researchDir, file), 'utf8'));
  for (const raw of items) {
    if (EXISTING_SLUGS.has(raw.slug)) {
      skipped.push({ title: raw.title, reason: 'already in seed' });
      continue;
    }
    if (seenSlugs.has(raw.slug) || seenIsbns.has(raw.isbn13)) {
      skipped.push({ title: raw.title, reason: 'duplicate in research' });
      continue;
    }
    try {
      const record = toRecord(raw);
      assertBannedBookRecord(record);
      records.push(record);
      seenSlugs.add(raw.slug);
      seenIsbns.add(raw.isbn13);
    } catch (error) {
      skipped.push({ title: raw.title, reason: error instanceof Error ? error.message : String(error) });
    }
  }
}

console.error(`Validated ${records.length} new records; skipped ${skipped.length}.`);
for (const s of skipped) {
  console.error(`  SKIP ${s.title}: ${s.reason}`);
}

console.log(records.map(formatRecord).join(',\n'));
