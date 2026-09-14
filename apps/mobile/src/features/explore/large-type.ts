/**
 * How many lines a one-line label may take once the OS text size grows.
 *
 * A row clamped to one line is the right rhythm at ordinary text sizes: the list scans, the
 * titles align, and a long name ellipsizes where a reader can still tell the rows apart. It
 * stops being right somewhere above 1.5x. At iOS's largest accessibility size (~3.1x) a record
 * title in a 300-400pt rail has room for about four characters, so "100 Block North Greenwood
 * Avenue", "10th U.S. Cavalry" and "1967 Detroit riot" all render as four characters and an
 * ellipsis — a list of rows a sighted reader cannot tell apart.
 *
 * The screen reader is unaffected either way (the row composes its own full label), which is
 * exactly why this is easy to miss: it is a sighted-large-type bug, and large type is used by
 * far more people than VoiceOver is.
 *
 * Growing the clamp rather than removing it keeps the one-line list at the sizes where one line
 * is the better design, and only spends vertical space where the alternative is unreadable.
 */

/**
 * Below this, nothing changes. 1.5x is roughly iOS's `extra-extra-extra-large` — the top of the
 * STANDARD range, before the accessibility sizes begin. Everything up to there still fits a
 * recognizable amount of a title on one line.
 */
export const LARGE_TYPE_THRESHOLD = 1.5;

/**
 * Lines a clamped label may take at `fontScale`.
 *
 * @param baseLines what the label is clamped to at ordinary text sizes (usually 1).
 * @param fontScale the OS text-size multiplier, from `useWindowDimensions().fontScale`.
 * @param maxLines the ceiling. Past it the label ellipsizes again rather than letting one row
 *   grow tall enough to push every other row off the screen.
 */
export function linesForFontScale(baseLines: number, fontScale: number, maxLines = 3): number {
  if (!Number.isFinite(fontScale) || fontScale < LARGE_TYPE_THRESHOLD) return baseLines;
  // One extra line per whole step of scale past the threshold: 1.5x-2.5x gets two, 2.5x and up
  // gets three. A title that still does not fit at three lines is genuinely long, and the row
  // has already given it six times the height it had.
  const extra = 1 + Math.floor(fontScale - LARGE_TYPE_THRESHOLD);
  return Math.min(maxLines, baseLines + extra);
}
