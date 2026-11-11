/** Address for a story, derived from its title. Never returns `new`, which is the create route. */
export function slugifyTitle(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // "Freedom's" reads as freedoms, not freedom-s.
    .replace(/['\u2018\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return slug === 'new' ? '' : slug;
}

/** The first of `base`, `base-2`, `base-3`... that is not already taken. Empty stays empty. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!base || !taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base.slice(0, 80 - String(n).length - 1)}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
