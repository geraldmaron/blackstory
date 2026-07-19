import { fireEvent, render } from '@testing-library/react-native';
import { EntityDetailScreen } from '../EntityDetailScreen';
import { normalizeEntity } from '../normalize';
import type { EntityDetailState } from '../useEntityDetail';
import {
  ALL_KINDS,
  claimWithMalformedCitationUrl,
  claimWithNoCitation,
  entityWithMaliciouslyLargeNarrative,
  entityWithMaliciousText,
  entityWithSelfReferencingNeighbor,
  entityWithUnclearedImageRights,
  entityWithZeroClaims,
  fullEntityFixture,
  minimalEntityFixture,
} from '../testFixtures';

function readyState(raw: Record<string, unknown>, degraded = false): EntityDetailState {
  const entity = normalizeEntity(raw)!;
  return {
    kind: 'ready',
    result: {
      status: 'ready',
      entity,
      freshness: { source: degraded ? 'cache' : 'network', fetchedAt: 1_753_000_000_000, degraded },
    },
  };
}

describe('EntityDetailScreen — fixture matrix across every entity kind', () => {
  it.each(ALL_KINDS)('renders a FULL fixture for kind=%s without crashing', async (kind) => {
    const { getByTestId, getByText } = await render(<EntityDetailScreen state={readyState(fullEntityFixture(kind))} />);
    expect(getByTestId('entity-detail-screen')).toBeTruthy();
    expect(getByText(`Full Fixture Record (${kind})`)).toBeTruthy();
  });

  it.each(ALL_KINDS)('renders a MINIMAL fixture for kind=%s (every optional field absent) without crashing', async (kind) => {
    const { getByTestId, getByText } = await render(<EntityDetailScreen state={readyState(minimalEntityFixture(kind))} />);
    expect(getByTestId('entity-detail-screen')).toBeTruthy();
    expect(getByText(`Minimal Fixture Record (${kind})`)).toBeTruthy();
    // No accepted claims / no dated history gaps must render, not crash.
    expect(getByText('No accepted claims yet')).toBeTruthy();
    expect(getByText('No dated history yet')).toBeTruthy();
  });
});

describe('EntityDetailScreen — non-ready states', () => {
  it('shows a dignified "not currently public" state for not-found (withdrawn or never-existed, indistinguishable by design)', async () => {
    const onBackToExplore = jest.fn();
    const { getByTestId, getByText, getByRole } = await render(
      <EntityDetailScreen state={{ kind: 'not-found' }} onBackToExplore={onBackToExplore} />,
    );
    expect(getByTestId('entity-not-found-state')).toBeTruthy();
    expect(getByText('This record is not currently public')).toBeTruthy();
    fireEvent.press(getByRole('button'));
    expect(onBackToExplore).toHaveBeenCalledTimes(1);
  });

  it('shows an offline-no-cache state distinct from the not-found state', async () => {
    const onRetry = jest.fn();
    const { getByTestId, getByText, getByRole } = await render(
      <EntityDetailScreen state={{ kind: 'offline-no-cache' }} onRetry={onRetry} />,
    );
    expect(getByTestId('entity-offline-no-cache-state')).toBeTruthy();
    expect(getByText(/hasn.t been viewed on this device/)).toBeTruthy();
    fireEvent.press(getByRole('button'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows a generic error state with retry for an unexpected failure', async () => {
    const onRetry = jest.fn();
    const { getByTestId, getByRole } = await render(
      <EntityDetailScreen state={{ kind: 'error', message: 'network exploded' }} onRetry={onRetry} />,
    );
    expect(getByTestId('entity-error-state')).toBeTruthy();
    fireEvent.press(getByRole('button'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows a loading indicator while resolving', async () => {
    const { getByTestId } = await render(<EntityDetailScreen state={{ kind: 'loading' }} />);
    expect(getByTestId('entity-loading-state')).toBeTruthy();
  });
});

describe('EntityDetailScreen — offline/cached display', () => {
  it('shows the cached "last updated" banner when freshness is degraded', async () => {
    const { getByText } = await render(<EntityDetailScreen state={readyState(fullEntityFixture('place'), true)} />);
    expect(getByText('Showing a saved copy')).toBeTruthy();
    expect(getByText(/Last updated 2025-07-20/)).toBeTruthy();
  });

  it('does NOT show the cached banner for a fresh network read', async () => {
    const { queryByText } = await render(<EntityDetailScreen state={readyState(fullEntityFixture('place'), false)} />);
    expect(queryByText('Showing a saved copy')).toBeNull();
  });
});

describe('EntityDetailScreen — adversarial content cases', () => {
  it('never renders a malformed (javascript:) citation URL as a live link', async () => {
    const raw = { ...fullEntityFixture('place'), claims: [claimWithMalformedCitationUrl()] };
    const { queryAllByRole, getByText } = await render(<EntityDetailScreen state={readyState(raw)} />);
    expect(getByText('Click here')).toBeTruthy();
    const links = queryAllByRole('link');
    for (const link of links) {
      expect(link.props.accessibilityLabel).not.toMatch(/click here/i);
    }
  });

  it('renders a claim with no citation without crashing, with an explicit fallback', async () => {
    const raw = { ...fullEntityFixture('place'), claims: [claimWithNoCitation()] };
    const { getByText } = await render(<EntityDetailScreen state={readyState(raw)} />);
    expect(getByText('No source citation is available for this claim.')).toBeTruthy();
  });

  it('shows the placeholder (never the image) for uncleared/unrecognized image rights', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <EntityDetailScreen state={readyState(entityWithUnclearedImageRights())} />,
    );
    expect(getByLabelText(/No image available/)).toBeTruthy();
    expect(queryByLabelText(/A photograph\./)).toBeNull();
  });

  it('handles zero claims with the approved gap copy, not a crash', async () => {
    const { getByText } = await render(<EntityDetailScreen state={readyState(entityWithZeroClaims())} />);
    expect(getByText('No accepted claims yet')).toBeTruthy();
  });

  it('keeps a disputed claim’s alternates visible — never silently resolved to one answer', async () => {
    const { getByText } = await render(<EntityDetailScreen state={readyState(fullEntityFixture('place'))} />);
    expect(getByText('Preserved contradiction')).toBeTruthy();
    expect(getByText(/1869 — Contradicting/)).toBeTruthy();
    expect(getByText(/1872 — Alternative \(not independently credible\)/)).toBeTruthy();
  });

  it('renders a maliciously large narrative promptly, truncated to the contract bound', async () => {
    const start = Date.now();
    const { getByText } = await render(<EntityDetailScreen state={readyState(entityWithMaliciouslyLargeNarrative())} />);
    expect(Date.now() - start).toBeLessThan(3000);
    expect(getByText('This passage has been shortened for display.')).toBeTruthy();
  });

  it('renders a self-referencing (cyclic) related-neighbor list flatly, exactly once each, no recursion', async () => {
    const { getAllByText } = await render(<EntityDetailScreen state={readyState(entityWithSelfReferencingNeighbor())} />);
    // The self-referencing neighbor's display name equals the entity's own display name; it
    // must appear exactly twice total (once as the screen title, once as the one related row),
    // never an unbounded/looping number of times.
    expect(getAllByText('Full Fixture Record (place)')).toHaveLength(2);
  });

  it('renders malicious HTML/Unicode text as inert literal text, never interpreted as markup', async () => {
    // The fixture deliberately places the same malicious payload in THREE fields
    // (displayName/summary/historicalContext), so more than one Text node legitimately matches —
    // proving each of those independent render sites treats it as inert text, not fewer.
    const { getAllByText } = await render(<EntityDetailScreen state={readyState(entityWithMaliciousText())} />);
    const matches = getAllByText(/<script>alert\(1\)<\/script>/);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe('EntityDetailScreen — related-entity navigation', () => {
  it('calls onOpenEntity with the tapped neighbor’s id (a fresh navigation, not inline expansion)', async () => {
    const onOpenEntity = jest.fn();
    const { getByText } = await render(
      <EntityDetailScreen state={readyState(fullEntityFixture('place'))} onOpenEntity={onOpenEntity} />,
    );
    fireEvent.press(getByText('Neighbor ent_neighbor_1'));
    expect(onOpenEntity).toHaveBeenCalledWith('ent_neighbor_1');
  });
});
