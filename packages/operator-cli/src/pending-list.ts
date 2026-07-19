/**
 * Lists pending editorial work from local discovery/obscurity JSON artifacts or a hand-built
 * subject file. Does not read Firestore yet — operators/agents pass paths from prior dry-runs.
 */
import { readFileSync } from 'node:fs';

export type PendingEditorialItem = {
  readonly subjectId: string;
  readonly title: string;
  readonly kind?: string;
  readonly existingSummary?: string;
  readonly score?: number;
  readonly band?: string;
  readonly source?: string;
};

export type PendingListResult = {
  readonly kind: 'editorial.pending.v1';
  readonly items: readonly PendingEditorialItem[];
  readonly count: number;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

/** Parse community-obscurity-run summary/full JSON or a plain `{ subjects: [...] }` file. */
export function loadPendingEditorialItems(paths: readonly string[]): PendingListResult {
  const items: PendingEditorialItem[] = [];
  for (const path of paths) {
    const raw = readJson(path);
    const root = asRecord(raw);
    if (!root) continue;

    const subjects = root.subjects;
    if (Array.isArray(subjects)) {
      for (const entry of subjects) {
        const row = asRecord(entry);
        if (!row || typeof row.subjectId !== 'string' || typeof row.title !== 'string') continue;
        items.push({
          subjectId: row.subjectId,
          title: row.title,
          ...(typeof row.kind === 'string' ? { kind: row.kind } : {}),
          ...(typeof row.existingSummary === 'string'
            ? { existingSummary: row.existingSummary }
            : {}),
          ...(typeof row.source === 'string' ? { source: row.source } : {}),
        });
      }
      continue;
    }

    const ranked =
      (Array.isArray(root.rankedTop) ? root.rankedTop : undefined) ??
      (asRecord(root.summary) && Array.isArray(asRecord(root.summary)?.rankedTop)
        ? (asRecord(root.summary)!.rankedTop as unknown[])
        : undefined) ??
      (asRecord(root.result) && Array.isArray(asRecord(asRecord(root.result)?.ranked)?.length)
        ? undefined
        : undefined);

    const rankedList =
      ranked ??
      (Array.isArray(asRecord(root.result)?.ranked)
        ? (asRecord(root.result)!.ranked as unknown[])
        : undefined);

    if (Array.isArray(rankedList)) {
      for (const entry of rankedList) {
        const row = asRecord(entry);
        if (!row) continue;
        const title = typeof row.title === 'string' ? row.title : undefined;
        if (!title) continue;
        const subjectId =
          typeof row.candidateId === 'string'
            ? row.candidateId
            : `pending_${title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .slice(0, 48)}`;
        items.push({
          subjectId,
          title,
          ...(typeof row.score === 'number' ? { score: row.score } : {}),
          ...(typeof row.band === 'string' ? { band: row.band } : {}),
          source: path,
        });
      }
    }
  }

  return {
    kind: 'editorial.pending.v1',
    items,
    count: items.length,
  };
}
