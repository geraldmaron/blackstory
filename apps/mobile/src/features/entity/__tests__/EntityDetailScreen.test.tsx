import { act, fireEvent, render } from '@testing-library/react-native';
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
import { buildIntroMetaLine } from '../sections/IntroSection';

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
    expect(getByTestId('entity-intro-section')).toBeTruthy();
  });

  it.each(ALL_KINDS)('renders a MINIMAL fixture for kind=%s (every optional field absent) without crashing', async (kind) => {
    const { getByTestId, getByText, queryByText } = await render(
      <EntityDetailScreen state={readyState(minimalEntityFixture(kind))} />,
    );
    expect(getByTestId('entity-detail-screen')).toBeTruthy();
    expect(getByText(`Minimal Fixture Record (${kind})`)).toBeTruthy();
    expect(getByText('No accepted claims yet')).toBeTruthy();
    expect(queryByText('No dated history yet')).toBeNull();
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
    expect(getAllByText('Full Fixture Record (place)')).toHaveLength(2);
  });

  it('renders malicious HTML/Unicode text as inert literal text, never interpreted as markup', async () => {
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

describe('EntityDetailScreen — maps hand-off', () => {
  it('renders anatomy with Open in maps and View on national map when geoAnchor is present', async () => {
    const onBackToMap = jest.fn();
    const { getByTestId, getAllByLabelText, getByLabelText, getByText } = await render(
      <EntityDetailScreen state={readyState(fullEntityFixture('place'))} onBackToMap={onBackToMap} />,
    );
    expect(getByTestId('entity-anatomy-section')).toBeTruthy();
    expect(getByText(/Location precision: Neighborhood/)).toBeTruthy();
    expect(getAllByLabelText(/Open Historic Dunbar neighborhood in Maps/).length).toBeGreaterThan(0);
    fireEvent.press(getByLabelText(/View Full Fixture Record \(place\) on the national map/));
    expect(onBackToMap).toHaveBeenCalledWith('ent_place_full_001');
  });

  it('omits Open in maps when there is no public geoAnchor, but still offers View on national map', async () => {
    const onBackToMap = jest.fn();
    const { queryByLabelText, getByLabelText, getByText } = await render(
      <EntityDetailScreen state={readyState(minimalEntityFixture('place'))} onBackToMap={onBackToMap} />,
    );
    expect(getByText('Place not pinned')).toBeTruthy();
    expect(queryByLabelText(/Open .* in Maps/)).toBeNull();
    fireEvent.press(getByLabelText(/View Minimal Fixture Record \(place\) on the national map/));
    expect(onBackToMap).toHaveBeenCalledWith('ent_place_minimal_001');
  });

  it('shows intro meta with kind, jurisdiction, and framing label', async () => {
    const entity = normalizeEntity(fullEntityFixture('place'))!;
    const { getByText } = await render(<EntityDetailScreen state={readyState(fullEntityFixture('place'))} />);
    expect(getByText(buildIntroMetaLine(entity))).toBeTruthy();
  });
});

describe('EntityDetailScreen — dense claims expand', () => {
  it('collapses claims beyond the preview count behind an expand control', async () => {
    const base = fullEntityFixture('place');
    const claims = [
      { ...(claimWithNoCitation() as Record<string, unknown>), id: 'claim_dense_1', object: 'First claim body.' },
      { ...(claimWithNoCitation() as Record<string, unknown>), id: 'claim_dense_2', object: 'Second claim body.' },
      { ...(claimWithNoCitation() as Record<string, unknown>), id: 'claim_dense_3', object: 'Third claim body.' },
    ];
    const { getByLabelText, getByText, queryByText } = await render(
      <EntityDetailScreen state={readyState({ ...base, claims })} />,
    );
    expect(getByText('First claim body.')).toBeTruthy();
    expect(getByText('Second claim body.')).toBeTruthy();
    expect(queryByText('Third claim body.')).toBeNull();
    await act(async () => {
      fireEvent.press(getByLabelText('Show 1 more claims'));
    });
    expect(getByText('Third claim body.')).toBeTruthy();
  });
});

describe('EntityDetailScreen — v6 edition beats', () => {
  it('renders numbered edition panels for intro, anatomy, and provenance', async () => {
    const { getByTestId, getByText } = await render(
      <EntityDetailScreen state={readyState(fullEntityFixture('place'))} />,
    );
    expect(getByTestId('entity-intro-section')).toBeTruthy();
    expect(getByTestId('entity-anatomy-section')).toBeTruthy();
    expect(getByTestId('entity-provenance-section')).toBeTruthy();
    expect(getByText('00 · Record')).toBeTruthy();
    expect(getByText('Record maturity and revision')).toBeTruthy();
  });
});
