/**
 * Character-run trimming that scans instead of backtracking.
 *
 * `value.replace(/\/+$/, '')` and friends read as the obvious way to strip a run of characters
 * off an end, and they are quadratic: on input that is a long run of the target character the
 * engine retries the match from every position (CodeQL js/polynomial-redos). These inputs are
 * URLs, slugs and harvested text, so their length is not ours to bound.
 *
 * A scan from the end (or the start) is linear, allocates nothing on the common path where
 * there is nothing to trim, and is easier to read than the expression it replaces.
 */

function isTrimmable(charCode: number, chars: string): boolean {
  return chars.includes(String.fromCharCode(charCode));
}

/** Remove every trailing character that appears in `chars`. */
export function trimTrailingChars(value: string, chars: string): string {
  let end = value.length;
  while (end > 0 && isTrimmable(value.charCodeAt(end - 1), chars)) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

/** Remove every leading character that appears in `chars`. */
export function trimLeadingChars(value: string, chars: string): string {
  let start = 0;
  while (start < value.length && isTrimmable(value.charCodeAt(start), chars)) {
    start += 1;
  }
  return start === 0 ? value : value.slice(start);
}

/** Remove every leading and trailing character that appears in `chars`. */
export function trimChars(value: string, chars: string): string {
  return trimLeadingChars(trimTrailingChars(value, chars), chars);
}

/** Remove trailing `/` characters. The common case: normalising an origin or a slug. */
export function trimTrailingSlashes(value: string): string {
  return trimTrailingChars(value, '/');
}
