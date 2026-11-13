/**
 * The source library's table: every publisher the released catalog cites, and how many records
 * cite it.
 *
 * It counts the same lineage keys the grade rule counts (`citedLineageKeys` from
 * `@repo/public-contracts/evidence`), so "12 records" here means twelve records whose grade could
 * have read that publisher. A record's own registry listing is included, because it is cited.
 *
 * Pure, so the client table can import the kinds. The loader is `load-source-library.ts`.
 *
 * Kind is read from the web address alone (.gov, .edu, Wikipedia). It is a fact about the
 * address, not a review of the publisher, and the page says so.
 *
 * A lineage key is a citation's source string with a few prefixes dropped, so one publisher still
 * arrives under many spellings: `catalog.archives.gov`, `tile.loc.gov`, "library of congress —
 * chronicling america", `nationalregister_sc_gov`, and internal markers like `citation_trail`
 * that are not publishers at all. `publisherFor` folds each key to one publisher (a site's
 * registrable domain, or a cleaned name) before counting, so the headline count is publishers,
 * not spellings, and a record citing two pages of one publisher counts once.
 */
import { WIKIPEDIA_LINEAGE_KEY } from '@repo/public-contracts/evidence';

export const SOURCE_KINDS = [
  'government',
  'university',
  'organization',
  'reference',
  'other',
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const SOURCE_KIND_LABELS: Readonly<Record<SourceKind, string>> = {
  government: 'Government',
  university: 'University',
  organization: 'Organization',
  reference: 'Reference',
  other: 'Other',
};

export type SourceRow = {
  /** The publisher's identity: a registrable domain, `wikipedia`, or a lowercased name. */
  readonly key: string;
  /** What the table prints: a name, or the site's address when no name is known. */
  readonly label: string;
  readonly kind: SourceKind;
  readonly records: number;
  /** The publisher's site, when it has one a reader can open. */
  readonly href: string | undefined;
};

export type SourceLibrary = {
  readonly rows: readonly SourceRow[];
  /** Records that cite at least one source. */
  readonly citingRecords: number;
  readonly totalRecords: number;
};

const HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function sourceKindFor(key: string): SourceKind {
  if (key === WIKIPEDIA_LINEAGE_KEY) return 'reference';
  // The Smithsonian is a federal trust that happens to hold an .edu address.
  if (key === 'si.edu') return 'government';
  if (!HOST.test(key)) return 'other';
  if (
    /\.(gov|mil)$/.test(key) ||
    /\.(state|k12)\.[a-z]{2}\.us$/.test(key) ||
    /\.gov\.[a-z]{2}$/.test(key)
  )
    return 'government';
  if (/\.edu$/.test(key)) return 'university';
  if (/\.org$/.test(key)) return 'organization';
  return 'other';
}

/** Workflow markers and placeholders that reach the citation field but name no publisher. */
const NOT_A_PUBLISHER = /^(citation_trail|other|catalog|unknown|n\/a|mentioned by .*)$/;

/** Names and internal keys that stand for a site the table already lists. */
const SAME_AS: Readonly<Record<string, string>> = {
  'library of congress': 'loc.gov',
  'national park service': 'nps.gov',
  'u.s. national park service': 'nps.gov',
  npgallery: 'nps.gov',
  'national archives': 'archives.gov',
  nara_catalog: 'archives.gov',
  smithsonian: 'si.edu',
  'smithsonian institution': 'si.edu',
  'african american registry': 'aaregistry.org',
  'encyclopedia virginia': 'encyclopediavirginia.org',
  'mississippi encyclopedia': 'mississippiencyclopedia.org',
  'new georgia encyclopedia': 'georgiaencyclopedia.org',
  'githubusercontent.com': 'github.com',
  'propublica nonprofit explorer': 'propublica.org',
};

/** A reader-facing name for the most cited sites; the rest print their address. */
const SITE_NAMES: Readonly<Record<string, string>> = {
  'archives.gov': 'National Archives',
  'loc.gov': 'Library of Congress',
  'nps.gov': 'National Park Service',
  'si.edu': 'Smithsonian Institution',
  'github.com': 'GitHub',
  'hmdb.org': 'Historical Marker Database',
  'blackpast.org': 'BlackPast',
  'britannica.com': 'Encyclopaedia Britannica',
  'house.gov': 'U.S. House of Representatives',
  'senate.gov': 'U.S. Senate',
  'ed.gov': 'U.S. Department of Education',
  'propublica.org': 'ProPublica',
};

/** The site a host belongs to: `catalog.archives.gov` is `archives.gov`. */
export function registrableDomain(host: string): string {
  const labels = host.split('.');
  const keep = /\.(state|k12)\.[a-z]{2}\.us$/.test(host)
    ? 4
    : /\.(gov|org|ac|co|edu)\.[a-z]{2}$/.test(host)
      ? 3
      : 2;
  return labels.slice(-keep).join('.');
}

const SMALL_WORDS = new Set(['a', 'an', 'and', 'at', 'for', 'in', 'of', 'on', 'the', 'to']);
const SHORT_FORMS = new Set([
  'ame',
  'a.m.e.',
  'a&m',
  'a&t',
  'cbs',
  'cpcrs',
  'dc',
  'naacp',
  'pbs',
  'u.s.',
  'uc',
  'wtvr',
]);

/** "north carolina a&t state university" to "North Carolina A&T State University". */
export function titleCase(name: string): string {
  return name
    .split(' ')
    .map((word, index) =>
      SHORT_FORMS.has(word)
        ? word.toUpperCase()
        : index > 0 && SMALL_WORDS.has(word)
          ? word
          : word.replace(
              /(^|[-/])([a-z])/g,
              (_, edge: string, letter: string) => edge + letter.toUpperCase(),
            ),
    )
    .join(' ');
}

type Publisher = {
  readonly key: string;
  readonly label: string;
  readonly href: string | undefined;
};

/** Folds one lineage key to its publisher, or `undefined` when the key names none. */
export function publisherFor(lineageKey: string): Publisher | undefined {
  if (lineageKey === WIKIPEDIA_LINEAGE_KEY) {
    return { key: lineageKey, label: 'Wikipedia and Wikidata', href: undefined };
  }
  // "Publisher — page or unit" names its publisher first; "(official site)" is not part of a name.
  let name = lineageKey
    .split(/\s+[—–-]\s+/)[0]!
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .trim();
  if (NOT_A_PUBLISHER.test(name)) return undefined;
  if (/^https?:\/\//.test(name)) {
    try {
      name = new URL(name).hostname.replace(/^www\./, '');
    } catch {
      return undefined;
    }
  }
  // An internal key spelled with underscores for dots: `nationalregister_sc_gov`.
  if (/^[a-z0-9-]+(_[a-z0-9-]+)*_(gov|org|edu|com|net|mil|us)$/.test(name)) {
    name = name.replaceAll('_', '.');
  }
  const site = SAME_AS[name] ?? (HOST.test(name) ? registrableDomain(name) : undefined);
  if (site !== undefined) {
    const domain = SAME_AS[site] ?? site;
    return { key: domain, label: SITE_NAMES[domain] ?? domain, href: `https://${domain}` };
  }
  if (name.includes('_')) return undefined;
  return { key: name, label: titleCase(name), href: undefined };
}

/** Counts, per publisher, the records citing it. Sorted most cited first, then by name. */
export function tallySources(perRecord: readonly (readonly string[])[]): SourceLibrary {
  const publishers = new Map<string, Publisher & { records: number }>();
  let citingRecords = 0;
  for (const keys of perRecord) {
    const cited = new Map<string, Publisher>();
    for (const key of keys) {
      const publisher = publisherFor(key);
      if (publisher !== undefined) cited.set(publisher.key, publisher);
    }
    if (cited.size > 0) citingRecords += 1;
    for (const publisher of cited.values()) {
      const row = publishers.get(publisher.key) ?? { ...publisher, records: 0 };
      row.records += 1;
      publishers.set(publisher.key, row);
    }
  }
  const rows = [...publishers.values()]
    .map(({ key, label, href, records }) => ({
      key,
      label,
      kind: sourceKindFor(key),
      records,
      href,
    }))
    .sort((a, b) => b.records - a.records || a.label.localeCompare(b.label));
  return { rows, citingRecords, totalRecords: perRecord.length };
}
