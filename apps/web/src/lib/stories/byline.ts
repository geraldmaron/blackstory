/** Public byline for a story: authors, then researchers and editors when credited. */
import type { StoryContributorDoc } from '@repo/schemas';

/** Neo is the house editorial identity and the implicit author when no author is credited. */
export const IMPLICIT_AUTHOR_NAME = 'Neo';

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function storyAuthorNames(contributors: readonly StoryContributorDoc[]): string[] {
  const authors = contributors.filter((c) => c.roles.includes('author')).map((c) => c.name);
  return authors.length > 0 ? authors : [IMPLICIT_AUTHOR_NAME];
}

/** One string per credit line, e.g. ["By A and B", "Research by C", "Edited by D"]. */
export function storyBylineLines(contributors: readonly StoryContributorDoc[]): string[] {
  const named = (role: StoryContributorDoc['roles'][number]) =>
    contributors.filter((c) => c.roles.includes(role)).map((c) => c.name);
  const lines = [`By ${joinNames(storyAuthorNames(contributors))}`];
  const researchers = named('researcher');
  if (researchers.length > 0) lines.push(`Research by ${joinNames(researchers)}`);
  const editors = named('editor');
  if (editors.length > 0) lines.push(`Edited by ${joinNames(editors)}`);
  return lines;
}
