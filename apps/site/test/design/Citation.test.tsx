import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Citation } from '../../src/design/components/Citation';
import { Notice } from '../../src/design/components/Notice';
import { render } from '../../src/design/testing';

test('Citation defaults to a Source-labeled aside with unlinked source and no notice', () => {
  const view = render(<Citation source="City archive" />);
  assert.equal(view.tags('aside').length, 1);
  assert.equal(view.attr('aside', 'aria-label'), 'Source');
  assert.equal(view.text(), 'Source City archive');
  assert.equal(view.tags('a').length, 0);
  assert.equal(view.attr('div', 'role'), null);
});

test('Citation preserves a custom label, class, children and native anchor attributes', () => {
  const view = render(
    <Citation
      label="Evidence"
      source="City archive"
      href="https://example.org/record?year=1920"
      className="custom"
    >
      <p>Page 12</p>
    </Citation>,
  );
  assert.equal(view.attr('aside', 'aria-label'), 'Evidence');
  assert.match(view.attr('aside', 'class') ?? '', /custom/);
  assert.equal(view.attr('a', 'href'), 'https://example.org/record?year=1920');
  assert.equal(view.attr('a', 'rel'), 'noopener noreferrer');
  assert.equal(view.text(), 'Evidence City archive Page 12');
  assert.match(view.raw, /min-height:var\(--c-size-touch\)/);
  assert.match(view.raw, /focus-visible/);
  assert.match(view.raw, /var\(--focusRing\)/);
});

test('Citation alive and redirected match the default without degraded-link notices', () => {
  const defaultText = render(<Citation source="Archive" />).text();
  for (const linkStatus of ['alive', 'redirected'] as const) {
    const view = render(
      <Citation
        source="Archive"
        linkStatus={linkStatus}
        deadAsOfDate="2026-01-01"
        archivedHref="https://example.org/archive"
        trySearchingFor="Search archive"
      />,
    );
    assert.equal(view.text(), defaultText);
    assert.equal(view.attr('div', 'role'), null);
  }
});

test('Citation dead composes Notice warning and keeps exact date/search copy', () => {
  for (const deadAsOfDate of [undefined, '2026-01-01']) {
    const title = `Link dead${deadAsOfDate ? ` as of ${deadAsOfDate}` : ''}`;
    const view = render(
      <Citation
        source="Archive"
        linkStatus="dead"
        deadAsOfDate={deadAsOfDate}
        trySearchingFor="Try searching for the city archive."
      />,
    );
    const notice = render(
      <Notice tone="warning" title={title}>
        Try searching for the city archive.
      </Notice>,
    );
    assert.equal(view.attr('div', 'role'), 'status');
    assert.equal(view.text(), `Source Archive ${notice.text()}`);
    assert.match(view.html, /Notice/);
    assert.equal(view.attr('span', 'aria-hidden'), 'true');
  }
  assert.equal(
    render(<Citation source="Archive" linkStatus="dead" />).text(),
    'Source Archive Warning Warning: Link dead',
  );
});

test('Citation dead archive link preserves href, rel, title and optional date/suggestion', () => {
  for (const deadAsOfDate of [undefined, '2026-01-01']) {
    const view = render(
      <Citation
        source="Archive"
        href="https://example.org/original"
        linkStatus="dead"
        archivedHref="https://example.org/capture"
        deadAsOfDate={deadAsOfDate}
        trySearchingFor="Try searching for Archive."
      />,
    );
    const links = view.tags('a');
    assert.equal(links.length, 2);
    assert.match(links[1]!, /href="https:\/\/example.org\/capture"/);
    assert.match(links[1]!, /rel="noopener noreferrer"/);
    assert.equal(
      view.text(),
      `Source Archive Warning Warning: Original link unavailable — archived copy View archived copy${deadAsOfDate ? ` · link dead as of ${deadAsOfDate}` : ''} Try searching for Archive.`,
    );
  }
});

test('Citation drifted composes Notice dispute with the exact source copy', () => {
  const body =
    'This link is reachable, but its current content no longer matches what was captured. Flagged for research review — the original capture remains the evidentiary anchor for this citation.';
  const notice = render(
    <Notice tone="dispute" title="Content may have changed since capture">
      {body}
    </Notice>,
  );
  const view = render(
    <Citation
      source="Archive"
      linkStatus="drifted"
      archivedHref="https://example.org/capture"
      trySearchingFor="Not displayed"
    />,
  );
  assert.equal(view.text(), `Source Archive ${notice.text()}`);
  assert.match(view.html, /Notice/);
  assert.equal(view.attr('div', 'role'), 'status');
  assert.equal(view.tags('a').length, 0);
  assert.doesNotMatch(view.text(), /Not displayed|View archived copy/);
});

test('Citation uses base and degraded-notice theme roles in both themes, without literal colors', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const linkStatus of ['alive', 'redirected', 'dead', 'drifted'] as const) {
      const view = render(
        <Citation source="Archive" href="https://example.org/record" linkStatus={linkStatus} />,
        theme,
      );
      for (const role of ['surface', 'borderStrong', 'ink', 'inkSubtle', 'focusRing']) {
        assert.ok(view.raw.includes(`var(--${role})`), `${theme} ${linkStatus} ${role}`);
      }
      if (linkStatus === 'dead' || linkStatus === 'drifted') {
        const tone = linkStatus === 'dead' ? 'warning' : 'dispute';
        for (const suffix of ['Fg', 'Bg', 'Border']) {
          assert.ok(view.raw.includes(`var(--${tone}${suffix})`), `${theme} ${tone}${suffix}`);
        }
      }
      assert.doesNotMatch(view.html, /#[0-9a-f]{3,8}\b|rgba?\(/i);
    }
  }
});

test('Citation supports long content, an empty label and empty optional href', () => {
  const source = 'A long archive source title '.repeat(40).trim();
  const view = render(
    <Citation label="" source={source} href="">
      Additional evidence
    </Citation>,
  );
  assert.equal(view.attr('aside', 'aria-label'), '');
  assert.equal(view.tags('a').length, 0);
  assert.equal(view.text(), `${source} Additional evidence`);
});

test('plain-text children are wrapped in a Text, since a View cannot hold a text node', () => {
  const view = render(<Citation source="Archive">Quoted passage.</Citation>);
  assert.match(view.html, /<p[^>]*>Quoted passage\.<\/p>/);
});
