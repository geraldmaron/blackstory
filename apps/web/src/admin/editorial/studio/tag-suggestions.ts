/**
 * Tag suggestions from the records a story links to. Nothing here applies a tag; the studio shows
 * each suggestion with its provenance and the writer accepts or dismisses it.
 */

export type RecordMeta = {
  id: string;
  displayName: string;
  kind: string;
  published: boolean;
  eraBuckets: string[];
  topicTags: string[];
};

export type TagSuggestion = {
  tag: string;
  kind: 'era' | 'subject';
  /** Records that led to the suggestion, in the order given. */
  records: { id: string; name: string }[];
};

/** Era tags in the stories vocabulary, by the first and last decade (inclusive) they cover. */
const ERA_RANGES: readonly { tag: string; from: number; to: number }[] = [
  { tag: 'Founding era', from: 1770, to: 1810 },
  { tag: 'Antebellum', from: 1820, to: 1850 },
  { tag: 'Civil War', from: 1860, to: 1860 },
  { tag: 'Reconstruction', from: 1860, to: 1870 },
  { tag: 'Jim Crow era', from: 1880, to: 1940 },
  { tag: 'Civil rights era', from: 1950, to: 1960 },
  { tag: 'Modern era', from: 1970, to: 9999 },
];

/** Decade starts named by buckets such as "1860s" or "1865". Anything else is ignored. */
export function decadesOf(buckets: readonly string[]): number[] {
  const out = new Set<number>();
  for (const bucket of buckets) {
    const match = /(\d{4})/.exec(bucket);
    if (match) out.add(Math.floor(Number(match[1]) / 10) * 10);
  }
  return [...out];
}

export function eraTagsForBuckets(buckets: readonly string[]): string[] {
  const decades = decadesOf(buckets);
  return ERA_RANGES.filter((r) => decades.some((d) => d >= r.from && d <= r.to)).map((r) => r.tag);
}

/** "school-desegregation" becomes "School desegregation". */
export function humanizeTag(tag: string): string {
  const text = tag.replace(/[-_]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

export function suggestTags(
  records: readonly RecordMeta[],
  options: { existing: readonly string[]; dismissed: ReadonlySet<string>; limit?: number },
): TagSuggestion[] {
  const skip = new Set([...options.existing, ...options.dismissed].map((t) => t.toLowerCase()));
  const found = new Map<string, TagSuggestion>();
  for (const record of records) {
    const tags: [string, TagSuggestion['kind']][] = [
      ...eraTagsForBuckets(record.eraBuckets).map((t): [string, 'era'] => [t, 'era']),
      ...record.topicTags.map((t): [string, 'subject'] => [humanizeTag(t), 'subject']),
    ];
    for (const [tag, kind] of tags) {
      if (!tag || skip.has(tag.toLowerCase())) continue;
      const key = tag.toLowerCase();
      const entry = found.get(key) ?? { tag, kind, records: [] };
      if (!entry.records.some((r) => r.id === record.id))
        entry.records.push({ id: record.id, name: record.displayName });
      found.set(key, entry);
    }
  }
  return [...found.values()]
    .sort((a, b) => b.records.length - a.records.length || a.tag.localeCompare(b.tag))
    .slice(0, options.limit ?? 6);
}

/** Record ids a story's text links as `[[id]]` or `[[id|label]]`, plus its map insets. */
export function mentionedRecordIds(body: readonly unknown[]): string[] {
  const ids = new Set<string>();
  const scan = (text: unknown) => {
    if (typeof text !== 'string') return;
    for (const m of text.matchAll(/\[\[([^|\][]+)(?:\|[^\][]+)?\]\]/g)) {
      const id = m[1]!.trim();
      if (id) ids.add(id);
    }
  };
  for (const raw of body) {
    const block = raw as Record<string, unknown>;
    scan(block.text);
    if (Array.isArray(block.items)) block.items.forEach(scan);
    if (Array.isArray(block.rows))
      block.rows.forEach((row) => Array.isArray(row) && row.forEach(scan));
    if (block.type === 'mapInset' && typeof block.entityId === 'string') ids.add(block.entityId);
  }
  return [...ids];
}
