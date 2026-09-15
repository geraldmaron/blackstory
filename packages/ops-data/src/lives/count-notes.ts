/**
 * Validation for Lives Across the Decades count notes ("What the count could see") before they load into
 * bb_reference.lives_count_notes. Every note needs a decade on the timeline, the groups it speaks to,
 * and at least one opened source with a web address. Method: docs/methodology/lives-across-decades.md.
 */
import { LIVES_AREAS, LIVES_DECADES, isLivesLens } from '@repo/domain/statistics/lives';

export type LivesCountNoteStatus = 'draft' | 'review' | 'published';

export type LivesCountNoteRecord = {
  readonly id: string;
  readonly decade: number;
  readonly appliesTo: readonly string[];
  readonly areaIds: readonly string[];
  readonly heading: string;
  readonly body: string;
  readonly citations: readonly { readonly label: string; readonly url: string }[];
  readonly sortOrder: number;
  readonly status: LivesCountNoteStatus;
};

const MAX_HEADING = 90;
const MAX_BODY = 700;
const STATUSES: readonly LivesCountNoteStatus[] = ['draft', 'review', 'published'];

export function validateLivesCountNotes(input: unknown): {
  readonly records: LivesCountNoteRecord[];
  readonly errors: string[];
} {
  const errors: string[] = [];
  if (!Array.isArray(input)) return { records: [], errors: ['notes file must be a JSON array'] };
  const areaIds = new Set(LIVES_AREAS.map((area) => area.id));
  const seen = new Set<string>();
  const records: LivesCountNoteRecord[] = [];

  input.forEach((raw, index) => {
    const where = `note ${index}`;
    if (!raw || typeof raw !== 'object') {
      errors.push(`${where}: not an object`);
      return;
    }
    const note = raw as Record<string, unknown>;
    const id = typeof note.id === 'string' ? note.id : '';
    const label = id ? `${where} (${id})` : where;
    const problems: string[] = [];
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) problems.push('id must be kebab-case');
    if (seen.has(id)) problems.push('duplicate id');
    seen.add(id);
    const decade = note.decade;
    if (typeof decade !== 'number' || !(LIVES_DECADES as readonly number[]).includes(decade)) {
      problems.push('decade must be a timeline decade');
    }
    const appliesTo = Array.isArray(note.appliesTo) ? note.appliesTo : [];
    if (
      appliesTo.length === 0 ||
      !appliesTo.every(
        (value) => value === 'all' || (typeof value === 'string' && isLivesLens(value)),
      )
    ) {
      problems.push('appliesTo must list black, white, hispanic or all');
    }
    const areas = Array.isArray(note.areaIds) ? note.areaIds : [];
    if (!areas.every((value) => typeof value === 'string' && areaIds.has(value))) {
      problems.push('areaIds must be Lives area ids');
    }
    for (const field of ['heading', 'body'] as const) {
      const text = note[field];
      const max = field === 'heading' ? MAX_HEADING : MAX_BODY;
      if (typeof text !== 'string' || text.trim().length === 0) {
        problems.push(`${field} is required`);
      } else {
        if (text.length > max) problems.push(`${field} is longer than ${max} characters`);
        if (/\s—\s/.test(text)) problems.push(`${field} has a spaced em dash`);
        if (/UNVERIFIED|TODO/i.test(text)) problems.push(`${field} carries a research marker`);
      }
    }
    const citations = Array.isArray(note.citations) ? note.citations : [];
    const validCitations = citations.filter(
      (citation): citation is { label: string; url: string } =>
        !!citation &&
        typeof citation === 'object' &&
        typeof (citation as { label?: unknown }).label === 'string' &&
        (citation as { label: string }).label.trim().length > 0 &&
        typeof (citation as { url?: unknown }).url === 'string' &&
        /^https:\/\//.test((citation as { url: string }).url),
    );
    if (validCitations.length === 0 || validCitations.length !== citations.length) {
      problems.push(
        'every citation needs a label and an https url, and there must be at least one',
      );
    }
    const status = note.status ?? 'review';
    if (!STATUSES.includes(status as LivesCountNoteStatus))
      problems.push('status is not draft, review or published');
    const sortOrder = note.sortOrder ?? 0;
    if (typeof sortOrder !== 'number' || !Number.isInteger(sortOrder))
      problems.push('sortOrder must be an integer');

    if (problems.length > 0) {
      errors.push(`${label}: ${problems.join('; ')}`);
      return;
    }
    records.push({
      id,
      decade: decade as number,
      appliesTo: appliesTo as string[],
      areaIds: areas as string[],
      heading: (note.heading as string).trim(),
      body: (note.body as string).trim(),
      citations: validCitations.map((citation) => ({
        label: citation.label.trim(),
        url: citation.url,
      })),
      sortOrder: sortOrder as number,
      status: status as LivesCountNoteStatus,
    });
  });
  return { records, errors };
}
