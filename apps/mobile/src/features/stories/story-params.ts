/**
 * Route-parameter validation for story routes. Grammar only: the slug must look like a published
 * slug before it reaches a request path. Existence is the server's answer.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseStorySlugParam(raw: unknown): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || value.length === 0 || value.length > 200) return undefined;
  return SLUG_PATTERN.test(value) ? value : undefined;
}
