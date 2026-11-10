/** Byline edits as pure list transforms, shared by the byline chips and the credits list. */
import type { StoryContributorDoc } from '@repo/schemas';

export type CreditRole = StoryContributorDoc['roles'][number];
export const CREDIT_ROLES: readonly CreditRole[] = ['author', 'researcher', 'editor'];
export const ROLE_LABELS: Record<CreditRole, string> = {
  author: 'Author',
  researcher: 'Researcher',
  editor: 'Editor',
};

/** Turns one role on or off. A credit always keeps at least one role. */
export function toggleRole(
  credits: readonly StoryContributorDoc[],
  id: string,
  role: CreditRole,
): StoryContributorDoc[] {
  return credits.map((credit) => {
    if (credit.id !== id) return credit;
    const roles = credit.roles.includes(role)
      ? credit.roles.filter((r) => r !== role)
      : CREDIT_ROLES.filter((r) => r === role || credit.roles.includes(r));
    return roles.length ? { ...credit, roles } : credit;
  });
}

export function moveCredit(
  credits: readonly StoryContributorDoc[],
  id: string,
  delta: -1 | 1,
): StoryContributorDoc[] {
  const from = credits.findIndex((c) => c.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= credits.length) return [...credits];
  const next = [...credits];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}
