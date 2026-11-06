/**
 * Heading levels for design-system components, so a caller can fit a component's title into the
 * page outline instead of inheriting whatever level the component was written with.
 *
 * `h1` is left out on purpose: it belongs to the page, never to a reusable part of it.
 */

export type HeadingLevel = 2 | 3 | 4 | 5 | 6;

export type HeadingTag = `h${HeadingLevel}`;

export function headingTag(level: HeadingLevel): HeadingTag {
  return `h${level}`;
}

/** The level for headings nested one step under `level`, capped at h6. */
export function subheadingLevel(level: HeadingLevel): HeadingLevel {
  return Math.min(level + 1, 6) as HeadingLevel;
}
