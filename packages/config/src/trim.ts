/**
 * Trailing-slash trimming, shared by the modules in this package that normalise an origin.
 *
 * `value.replace(/\/+$/, '')` is the obvious spelling and is quadratic on input ending in a long
 * run of slashes (CodeQL js/polynomial-redos). These values come from deploy configuration, so
 * their length is not ours to bound. Scanning back from the end is linear and allocates nothing
 * when there is nothing to trim.
 */

const SLASH = '/'.charCodeAt(0);

export function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === SLASH) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}
