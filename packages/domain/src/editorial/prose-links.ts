/**
 * Entity prose-link markup: parse, strip, serialize, and catalog-driven linkification
 * for editorial drafts using the `[[entityId|Display Label]]` convention.
 */

export type ProseEntityRef = {
  readonly entityId: string;
  readonly label?: string;
};

export type CatalogLinkTarget = {
  readonly id: string;
  readonly displayName: string;
  readonly aliases?: readonly string[];
};

/** Matches `[[entityId]]` or `[[entityId|Display Label]]` (global, stateful). */
export const ENTITY_PROSE_LINK_RE = /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g;

/** Returns entity refs in document order without mutating the source string. */
export function parseProseEntityLinks(text: string): readonly ProseEntityRef[] {
  const refs: ProseEntityRef[] = [];
  for (const match of text.matchAll(ENTITY_PROSE_LINK_RE)) {
    const entityId = match[1]?.trim() ?? '';
    if (!entityId) continue;
    const rawLabel = match[2]?.trim();
    refs.push({
      entityId,
      ...(rawLabel !== undefined && rawLabel.length > 0 ? { label: rawLabel } : {}),
    });
  }
  return refs;
}

/** Removes markup while preserving visible labels (falls back to entity id when no label). */
export function stripProseEntityLinks(text: string): string {
  return text.replace(ENTITY_PROSE_LINK_RE, (_full, entityId: string, label?: string) => {
    const trimmedLabel = label?.trim();
    return trimmedLabel !== undefined && trimmedLabel.length > 0 ? trimmedLabel : entityId.trim();
  });
}

/** Serializes one ref back to editorial markup. */
export function serializeProseEntityLink(ref: ProseEntityRef): string {
  const entityId = ref.entityId.trim();
  const label = ref.label?.trim();
  if (label !== undefined && label.length > 0) {
    return `[[${entityId}|${label}]]`;
  }
  return `[[${entityId}]]`;
}

export type LinkifyProseOptions = {
  readonly skipEntityIds?: readonly string[];
};

export type LinkifyProseResult = {
  readonly text: string;
  readonly links: readonly ProseEntityRef[];
};

type PlainSegment = {
  readonly start: number;
  readonly end: number;
  readonly value: string;
};

type NameCandidate = {
  readonly entityId: string;
  readonly name: string;
};

type SpanMatch = {
  readonly entityId: string;
  readonly name: string;
  readonly start: number;
  readonly end: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectPlainSegments(text: string): readonly PlainSegment[] {
  const segments: PlainSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(ENTITY_PROSE_LINK_RE)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({ start: cursor, end: index, value: text.slice(cursor, index) });
    }
    cursor = index + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ start: cursor, end: text.length, value: text.slice(cursor) });
  }
  return segments;
}

function buildNameCandidates(
  catalog: readonly CatalogLinkTarget[],
  skipEntityIds: ReadonlySet<string>,
): readonly NameCandidate[] {
  const candidates: NameCandidate[] = [];
  for (const entry of catalog) {
    if (skipEntityIds.has(entry.id)) continue;
    if (entry.displayName.trim().length > 0) {
      candidates.push({ entityId: entry.id, name: entry.displayName });
    }
    for (const alias of entry.aliases ?? []) {
      const trimmed = alias.trim();
      if (trimmed.length > 0) {
        candidates.push({ entityId: entry.id, name: trimmed });
      }
    }
  }
  return candidates.sort((left, right) => right.name.length - left.name.length);
}

function findSpanMatches(plain: string, candidates: readonly NameCandidate[]): readonly SpanMatch[] {
  const occupied = new Array<boolean>(plain.length).fill(false);
  const matches: SpanMatch[] = [];

  for (const candidate of candidates) {
    const pattern = new RegExp(
      `(?<![A-Za-z0-9_])${escapeRegExp(candidate.name)}(?![A-Za-z0-9_])`,
      'g',
    );
    for (const match of plain.matchAll(pattern)) {
      const start = match.index ?? 0;
      const end = start + candidate.name.length;
      if (occupied.slice(start, end).some(Boolean)) continue;
      for (let index = start; index < end; index += 1) {
        occupied[index] = true;
      }
      matches.push({
        entityId: candidate.entityId,
        name: candidate.name,
        start,
        end,
      });
    }
  }

  return matches.sort((left, right) => left.start - right.start);
}

function linkifyPlainSegment(plain: string, candidates: readonly NameCandidate[]): {
  readonly text: string;
  readonly links: readonly ProseEntityRef[];
} {
  const matches = findSpanMatches(plain, candidates);
  if (matches.length === 0) {
    return { text: plain, links: [] };
  }

  const links: ProseEntityRef[] = [];
  let cursor = 0;
  let linked = '';

  for (const match of matches) {
    linked += plain.slice(cursor, match.start);
    const ref: ProseEntityRef = {
      entityId: match.entityId,
      label: match.name,
    };
    linked += serializeProseEntityLink(ref);
    links.push(ref);
    cursor = match.end;
  }
  linked += plain.slice(cursor);

  return { text: linked, links };
}

/**
 * Longest-name-first catalog matching on plain spans only; existing `[[...]]` markup is preserved.
 */
export function linkifyProseAgainstCatalog(
  text: string,
  catalog: readonly CatalogLinkTarget[],
  options: LinkifyProseOptions = {},
): LinkifyProseResult {
  const skipEntityIds = new Set(options.skipEntityIds ?? []);
  const candidates = buildNameCandidates(catalog, skipEntityIds);
  const segments = collectPlainSegments(text);
  const allLinks: ProseEntityRef[] = [];
  let output = '';
  let cursor = 0;

  for (const segment of segments) {
    output += text.slice(cursor, segment.start);
    const linked = linkifyPlainSegment(segment.value, candidates);
    output += linked.text;
    allLinks.push(...linked.links);
    cursor = segment.end;
  }
  output += text.slice(cursor);

  return { text: output, links: allLinks };
}
