/**
 * ContentRenderer tests (MOB-015 requirement #7/#9): heading hierarchy, no Dynamic-Type-clipping
 * `numberOfLines`, RTL text rendering, cached/offline + stale-version affordances, missing-citation
 * warning, and that an unsafe source href degrades to plain text instead of an openable link.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { normalizeTypedContentPage } from './content-blocks';
import { ContentRenderer } from './ContentRenderer';
import type { ContentPageV1 } from './content-types';

const BASE_PAGE: ContentPageV1 = {
  slug: 'test',
  title: 'A Test Page',
  dek: 'A short deck.',
  publishedAt: '2026-01-01',
  eraLabel: '2020s',
  placeLabel: 'Washington, D.C.',
  relatedEntityIds: ['ent_a', 'ent_b'],
  relatedFactIds: ['BB-F-000001'],
  body: [
    { heading: 'Section heading', paragraphs: ['Body paragraph one.'] },
    { paragraphs: ['Body paragraph two.'] },
  ],
};

async function renderPage(page: ContentPageV1, extra: Partial<React.ComponentProps<typeof ContentRenderer>> = {}) {
  const { page: normalized, blocks, skippedSections } = normalizeTypedContentPage(page);
  if (!normalized) throw new Error('expected a valid page for this test');
  return render(
    <ContentRenderer page={normalized} blocks={blocks} skippedSections={skippedSections} {...extra} />,
  );
}

describe('ContentRenderer', () => {
  it('renders the page title and dek', async () => {
    const { getByText } = await renderPage(BASE_PAGE);
    expect(getByText('A Test Page')).toBeTruthy();
    expect(getByText('A short deck.')).toBeTruthy();
  });

  it('exposes a heading role for the page title and section headings (heading hierarchy)', async () => {
    const { getAllByRole } = await renderPage(BASE_PAGE);
    const headers = getAllByRole('header');
    // Page title + "Section heading" + "Related records" + "Cited facts" headers.
    const headerTexts = headers.map((node) => node.props.children).flat();
    expect(headerTexts).toContain('A Test Page');
    expect(headerTexts).toContain('Section heading');
  });

  it('never sets numberOfLines on body text (large Dynamic Type must not clip content)', async () => {
    const { getByText } = await renderPage(BASE_PAGE);
    const paragraph = getByText('Body paragraph one.');
    expect(paragraph.props.numberOfLines).toBeUndefined();
  });

  it('renders RTL content (Arabic) without crashing', async () => {
    const rtlPage: ContentPageV1 = {
      ...BASE_PAGE,
      title: 'صفحة اختبار',
      body: [{ paragraphs: ['هذه فقرة تجريبية باللغة العربية.'] }],
    };
    const { getByText } = await renderPage(rtlPage);
    expect(getByText('صفحة اختبار')).toBeTruthy();
    expect(getByText('هذه فقرة تجريبية باللغة العربية.')).toBeTruthy();
  });

  it('shows a cached/offline notice with a relative "last updated" label', async () => {
    const { getByText } = await renderPage(BASE_PAGE, {
      cached: { fetchedAt: Date.now() - 5000, degraded: true },
    });
    expect(getByText('Showing cached copy (offline)')).toBeTruthy();
  });

  it('shows an "up to date" notice when served fresh from the network', async () => {
    const { getByText } = await renderPage(BASE_PAGE, {
      cached: { fetchedAt: Date.now(), degraded: false },
    });
    expect(getByText('Up to date')).toBeTruthy();
  });

  it('hides the fresh "up to date" notice in longform presentation', async () => {
    const { queryByText } = await renderPage(BASE_PAGE, {
      presentation: 'longform',
      cached: { fetchedAt: Date.now(), degraded: false },
    });
    expect(queryByText('Up to date')).toBeNull();
  });

  it('still shows offline cache notice in longform presentation', async () => {
    const { getByText } = await renderPage(BASE_PAGE, {
      presentation: 'longform',
      cached: { fetchedAt: Date.now() - 5000, degraded: true },
    });
    expect(getByText('Showing cached copy (offline)')).toBeTruthy();
  });

  it('uses the editorial type scale (17/27) for longform body text', async () => {
    const { getByText } = await renderPage(BASE_PAGE, { presentation: 'longform' });
    const paragraph = getByText('Body paragraph one.');
    // The longform paragraph must inherit the shared `editorial` variant (17/27 Source Serif)
    // rather than a one-off 18/30 override that drifts from the type scale.
    const flattened = Object.assign({}, ...[paragraph.props.style].flat());
    expect(flattened.fontSize).toBe(17);
    expect(flattened.lineHeight).toBe(27);
    expect(flattened.fontFamily).toBe('SourceSerif4-Regular');
  });

  it('shows a stale-legal-version affordance and fires onViewCurrent when pressed', async () => {
    const onViewCurrent = jest.fn();
    const { getByText } = await renderPage(BASE_PAGE, { versionStale: true, onViewCurrent });
    expect(getByText('This version may be outdated')).toBeTruthy();
    fireEvent.press(getByText('View current'));
    expect(onViewCurrent).toHaveBeenCalledTimes(1);
  });

  it('shows a missing-citation warning for a claim-like page with no sources', async () => {
    const { getByText } = await renderPage(BASE_PAGE, { requiresCitation: true, sources: [] });
    expect(getByText('No cited sources')).toBeTruthy();
  });

  it('does not show a missing-citation warning when sources are present', async () => {
    const { queryByText, getByText } = await renderPage(BASE_PAGE, {
      requiresCitation: true,
      sources: [{ source: 'Example', label: 'Example source', href: 'https://example.com' }],
    });
    expect(queryByText('No cited sources')).toBeNull();
    expect(getByText('Example source')).toBeTruthy();
  });

  it('degrades an unsafe source href (javascript:) to plain text, never an openable link', async () => {
    const { getByText, queryByRole } = await renderPage(BASE_PAGE, {
      sources: [{ source: 'Bad', label: 'Suspicious source', href: 'javascript:alert(1)' }],
    });
    expect(getByText('Suspicious source')).toBeTruthy();
    const links = queryByRole('link');
    // No accessible link role should exist for the unsafe href (there may be no links at all here).
    if (links) {
      expect(links.props.accessibilityLabel).not.toMatch(/Suspicious source/);
    }
  });

  it('shows a "some content was skipped" notice when sections were dropped', async () => {
    const { getByText } = await render(
      <ContentRenderer
        page={normalizeTypedContentPage(BASE_PAGE).page!}
        blocks={[]}
        skippedSections={3}
      />,
    );
    expect(getByText('Some content was skipped')).toBeTruthy();
  });

  it('renders related entities and cited facts with human labels, not raw entity ids', async () => {
    const { getAllByText, getByText, queryByText } = await renderPage(BASE_PAGE);
    expect(getAllByText('Archive record').length).toBeGreaterThanOrEqual(1);
    expect(queryByText('ent_a')).toBeNull();
    expect(queryByText('ent_b')).toBeNull();
    expect(getByText('BB-F-000001')).toBeTruthy();
  });

  it('labels known related entities with display name and kind · place', async () => {
    const { getByText, queryByText } = await renderPage({
      ...BASE_PAGE,
      relatedEntityIds: ['ent_dunbar_school_001'],
    });
    expect(getByText('Paul Laurence Dunbar High School')).toBeTruthy();
    expect(getByText('School · Washington, D.C.')).toBeTruthy();
    expect(queryByText('ent_dunbar_school_001')).toBeNull();
  });
});
