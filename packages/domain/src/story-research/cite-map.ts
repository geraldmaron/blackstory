/**
 * Sentence-level cite map: every load-bearing sentence maps to a published
 * claim/fact/entity or stays unresolved (blocks recommend).
 */

export const CITE_KINDS = ['claim', 'fact', 'entity', 'unresolved', 'framing'] as const;
export type CiteKind = (typeof CITE_KINDS)[number];

export type StoryCiteEntry = {
  readonly sentenceId: string;
  readonly text: string;
  readonly citeKind: CiteKind;
  readonly citeId?: string;
};

export type BuildStoryCiteEntryInput = {
  readonly sentenceId: string;
  readonly text: string;
  readonly citeKind: CiteKind;
  readonly citeId?: string;
};

export function buildStoryCiteEntry(input: BuildStoryCiteEntryInput): StoryCiteEntry {
  const needsId =
    input.citeKind === 'claim' || input.citeKind === 'fact' || input.citeKind === 'entity';
  const citeId = input.citeId?.trim();

  return Object.freeze({
    sentenceId: input.sentenceId.trim(),
    text: input.text.trim(),
    citeKind: input.citeKind,
    ...(needsId && citeId ? { citeId } : {}),
  });
}

/** True when the entry is resolved enough to support a recommend decision. */
export function citeEntryIsResolved(entry: StoryCiteEntry): boolean {
  if (entry.citeKind === 'framing') return true;
  if (entry.citeKind === 'unresolved') return false;
  return typeof entry.citeId === 'string' && entry.citeId.length > 0;
}
