/**
 * Which published record each errata entry changed.
 *
 * The seed stores no record id, only a headline written "Record name: what changed". A name that
 * matches exactly one published record links to it; a name that matches none or several links to
 * nothing, because a link to the wrong record is worse than no link.
 */
import { splitErrataHeadline } from './errata-headline';
import type { ErrataEntry } from '../../lib/trust/errata-seed';

export type CatalogName = { readonly id: string; readonly displayName: string };

const normalize = (name: string) =>
  name.normalize('NFKC').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

function nameIndex(catalog: readonly CatalogName[]): ReadonlyMap<string, readonly string[]> {
  const byName = new Map<string, string[]>();
  for (const record of catalog) {
    const key = normalize(record.displayName ?? '');
    if (key.length === 0) continue;
    byName.set(key, [...(byName.get(key) ?? []), record.id]);
  }
  return byName;
}

const hrefFor = (byName: ReadonlyMap<string, readonly string[]>, name: string) => {
  const ids = byName.get(normalize(name));
  return ids?.length === 1 ? `/entity/${encodeURIComponent(ids[0]!)}` : undefined;
};

/**
 * Record links for the log: entry id to the record its headline names, and, for an entry that
 * touched several records, each listed name to its record.
 */
export function resolveErrataRecordHrefs(
  entries: readonly ErrataEntry[],
  catalog: readonly CatalogName[],
): ReadonlyMap<string, string> {
  const byName = nameIndex(catalog);
  const hrefs = new Map<string, string>();
  for (const entry of entries) {
    const { subject } = splitErrataHeadline(entry.headline);
    const href = subject === undefined ? undefined : hrefFor(byName, subject);
    if (href !== undefined) hrefs.set(entry.id, href);
    for (const name of entry.affectedRecords ?? []) {
      const listed = hrefFor(byName, name);
      if (listed !== undefined) hrefs.set(`${entry.id}#${name}`, listed);
    }
  }
  return hrefs;
}
