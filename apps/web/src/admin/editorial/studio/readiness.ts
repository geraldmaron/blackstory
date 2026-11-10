/**
 * Everything that blocks publication, in one list. Local checks name the exact field; the server's
 * own blockers are mapped to the same targets so a problem is never listed twice.
 */
import type { StoryDraft } from '@repo/schemas';

export type SectionId =
  | 'readiness'
  | 'address'
  | 'topics'
  | 'credits'
  | 'sources'
  | 'records'
  | 'collection'
  | 'history'
  | 'archive';

/** Where "Show" takes the writer. */
export type ShowTarget =
  | { kind: 'field'; id: string }
  | { kind: 'section'; section: SectionId }
  | { kind: 'block'; index: number };

export type ReadinessItem = { key: string; text: string; target: ShowTarget | null };
export type BodyIssue = { index: number; message: string };

const field = (id: string): ShowTarget => ({ kind: 'field', id });

function serverKey(message: string): { key: string; target: ShowTarget | null } {
  const block = /^body\.(\d+)/.exec(message);
  if (block)
    return { key: `server-body-${block[1]}`, target: { kind: 'block', index: +block[1]! } };
  if (/human author/i.test(message)) return { key: 'author', target: field('studio-byline') };
  if (/attach the sources/i.test(message))
    return { key: 'sources-none', target: { kind: 'section', section: 'sources' } };
  if (/^title\b/.test(message)) return { key: 'title', target: field('studio-title') };
  if (/^summary\b/.test(message)) return { key: 'summary', target: field('studio-summary') };
  if (/^eraLabel\b/.test(message)) return { key: 'era', target: field('studio-era') };
  if (/^placeLabel\b/.test(message)) return { key: 'place', target: field('studio-place') };
  if (/^heroImage\.alt\b/.test(message))
    return { key: 'cover-alt', target: field('studio-cover-alt') };
  if (/^heroImage\.credit\b/.test(message))
    return { key: 'cover-credit', target: field('studio-cover-credit') };
  if (/citation|reference|source|\[ref/i.test(message))
    return { key: `server-${message}`, target: { kind: 'section', section: 'sources' } };
  return { key: `server-${message}`, target: null };
}

export function readinessItems(
  draft: StoryDraft,
  serverBlockers: readonly string[] = [],
  bodyIssues: readonly BodyIssue[] = [],
): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  const add = (key: string, text: string, target: ShowTarget | null) =>
    items.push({ key, text, target });
  if (!draft.title.trim()) add('title', 'The story needs a title.', field('studio-title'));
  if (!draft.summary.trim())
    add(
      'summary',
      'The story needs a summary. Readers see it first and in search results.',
      field('studio-summary'),
    );
  if (!draft.eraLabel.trim()) add('era', 'Add the period the story covers.', field('studio-era'));
  if (!draft.placeLabel.trim())
    add('place', 'Add the place the story is about.', field('studio-place'));
  if (!draft.contributors.some((c) => c.kind === 'person' && c.roles.includes('author')))
    add(
      'author',
      'Credit a person as author. Neo can write with you, but a person answers for the story.',
      field('studio-byline'),
    );
  if (draft.heroImage && !draft.heroImage.alt.trim())
    add('cover-alt', 'The cover image needs a description.', field('studio-cover-alt'));
  if (draft.heroImage && !draft.heroImage.credit.trim())
    add('cover-credit', 'The cover image needs a credit.', field('studio-cover-credit'));
  draft.body.forEach((block, index) => {
    if (block.type === 'image' && !block.image.alt.trim())
      add(`block-alt-${index}`, `The image in block ${index + 1} needs a description.`, {
        kind: 'block',
        index,
      });
  });
  if (!draft.references.length)
    add('sources-none', 'Attach the sources supporting the story.', {
      kind: 'section',
      section: 'sources',
    });
  draft.references.forEach((ref, index) => {
    if (!ref.label.trim() || !ref.url.trim())
      add(`source-${index}`, `Source ${index + 1} needs a title and a URL.`, {
        kind: 'section',
        section: 'sources',
      });
  });
  bodyIssues.forEach((issue, n) =>
    add(`body-${n}`, issue.message, { kind: 'block', index: issue.index }),
  );
  const have = new Set(items.map((i) => i.key));
  for (const message of serverBlockers) {
    const { key, target } = serverKey(message);
    if (have.has(key)) continue;
    have.add(key);
    add(key, message, target);
  }
  return items;
}
