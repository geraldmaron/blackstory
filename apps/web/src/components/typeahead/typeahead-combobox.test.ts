/**
 * The typeahead's request budget, and the difference between "nothing matched" and "we could not
 * look".
 *
 * These are source-shape guards rather than interaction tests, for the reason
 * `command-bar-search.test.tsx` already states: this package ships no DOM harness, and the
 * behavior at stake is what the component does across a burst of keystrokes and a failing
 * response — neither of which `renderToStaticMarkup` reaches. The rules below are cheap to
 * re-break by accident and expensive to notice in production, which is what makes them worth
 * pinning even in this weaker form.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'TypeaheadCombobox.tsx'), 'utf8');

/** Source with prose removed, so a rule documented in a comment cannot satisfy its own test. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

describe('typeahead request budget', () => {
  it('debounces the remote lane', () => {
    // Undebounced, one typed phrase spent the whole per-minute quota of `/search/api`: typing
    // "tulsa massacre" fired thirteen requests and the endpoint answered the last six with 429,
    // so the reader was rate-limited by the act of finishing the word.
    assert.match(code, /remoteDebounceMs/);
    assert.match(code, /setTimeout\(/);
    assert.match(code, /clearTimeout\(/);
  });

  it('leaves the local lane undebounced', () => {
    // `suggestLocal` ranks an array already in memory. Delaying it would buy nothing and cost
    // every keystroke on the books catalogue its responsiveness.
    const localBranch = code.slice(
      code.indexOf('if (suggestLocal)'),
      code.indexOf('if (!suggestRemote)'),
    );
    assert.doesNotMatch(localBranch, /setTimeout/);
  });

  it('passes the abort signal to the suggestor instead of only ignoring late answers', () => {
    assert.match(code, /suggestRemote\(trimmed, controller\.signal\)/);
    assert.match(code, /signal: AbortSignal/);
  });

  it("creates one controller per effect run and aborts it in that run's cleanup", () => {
    // The previous shape kept the controller in a ref and aborted the PREVIOUS one on the way in,
    // which left the last keystroke's request running past unmount with nothing to cancel it.
    assert.doesNotMatch(code, /abortRef/);
    assert.match(code, /return \(\) => \{[\s\S]*?controller\.abort\(\);/);
  });
});

describe('a failed lookup is not an empty one', () => {
  it('tracks unavailability separately from an empty result set', () => {
    assert.match(code, /setUnavailable\(true\)/);
    assert.match(code, /setUnavailable\(false\)/);
    assert.match(code, /showUnavailable/);
  });

  it('does not announce "No matching suggestions" when the lookup failed', () => {
    // The live region is the only channel a screen-reader user has here, so the branch order in
    // `statusMessage` is the accessible behavior, not a detail of it.
    const start = code.indexOf('const statusMessage');
    const status = code.slice(start, code.indexOf(';', code.indexOf('available`', start)));
    assert.ok(
      status.indexOf('showUnavailable') < status.indexOf('No matching suggestions'),
      'unavailability must be checked before the empty-result message',
    );
  });

  it('keeps the note out of the listbox', () => {
    // A note is not an option: inside `role="listbox"` it would be arrowable and would announce
    // itself as one available suggestion.
    const list = code.slice(code.indexOf('{showList ?'));
    assert.doesNotMatch(list, /ds-typeahead__note/);
    assert.match(code, /className="ds-typeahead__note" role="status"/);
  });
});
