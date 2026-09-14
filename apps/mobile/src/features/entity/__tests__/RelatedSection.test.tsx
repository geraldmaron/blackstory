/**
 * Connected records: the evidence meter reaches the link rows.
 *
 * The assertion that matters is not "a meter is drawn" but "the grade was derived here". The
 * fixture neighbor carries evidence INPUTS — two corroborating lineages behind a high claim — and
 * the row must reach grade A from them. Hand the same row one lineage and it must step down to B
 * without anything else changing, which is only possible if the rule, not the payload, decides.
 */
import { render } from '@testing-library/react-native';
import { RelatedSection } from '../sections/RelatedSection';
import { normalizeEntity } from '../normalize';
import { fullEntityFixture } from '../testFixtures';
import type { RelatedNeighbor } from '../types';

function neighborsFrom(raw: Record<string, unknown>): readonly RelatedNeighbor[] {
  return normalizeEntity(raw)!.relatedNeighbors ?? [];
}

describe('RelatedSection evidence meter', () => {
  it('draws a meter on every connected record that carries evidence inputs', async () => {
    const neighbors = neighborsFrom(fullEntityFixture('place'));
    expect(neighbors.length).toBeGreaterThan(0);

    const { getByTestId } = await render(
      <RelatedSection relatedNeighbors={neighbors} continueLearning={[]} index="08" />,
    );
    for (const neighbor of neighbors) {
      expect(
        getByTestId(`entity-related-meter-${neighbor.id}`, { includeHiddenElements: true }),
      ).toBeTruthy();
    }
  });

  it('speaks the grade in the row label, so color is never the only cue', async () => {
    const neighbors = neighborsFrom(fullEntityFixture('place'));
    const { getAllByLabelText } = await render(
      <RelatedSection relatedNeighbors={neighbors} continueLearning={[]} index="08" />,
    );
    // Grade A: strongest claim high, two lineages that can corroborate. Every row says so.
    expect(getAllByLabelText(/Evidence: Evidence grade A/i)).toHaveLength(neighbors.length);
  });

  it('steps a single-lineage neighbor down, from the same payload minus one lineage', async () => {
    const raw = fullEntityFixture('place');
    const neighbors = (raw.relatedNeighbors as Record<string, unknown>[]).map((n) => ({
      ...n,
      evidenceInputs: {
        strongestClaimLevel: 'high',
        citedLineageKeys: ['loc.gov'],
        evidenceLineageKeys: ['loc.gov'],
      },
    }));
    const { getAllByLabelText, queryByLabelText } = await render(
      <RelatedSection
        relatedNeighbors={neighborsFrom({ ...raw, relatedNeighbors: neighbors })}
        continueLearning={[]}
        index="08"
      />,
    );
    expect(getAllByLabelText(/Evidence: Evidence grade B/i).length).toBeGreaterThan(0);
    expect(queryByLabelText(/Evidence: Evidence grade A/i)).toBeNull();
  });

  it('draws no meter when the neighbor carries no inputs — unknown is not unrated', async () => {
    const raw = fullEntityFixture('place');
    const neighbors = (raw.relatedNeighbors as Record<string, unknown>[]).map((n) => {
      const copy = { ...n };
      delete copy.evidenceInputs;
      return copy;
    });
    const resolved = neighborsFrom({ ...raw, relatedNeighbors: neighbors });
    const { queryByTestId } = await render(
      <RelatedSection relatedNeighbors={resolved} continueLearning={[]} index="08" />,
    );
    for (const neighbor of resolved) {
      expect(
        queryByTestId(`entity-related-meter-${neighbor.id}`, { includeHiddenElements: true }),
      ).toBeNull();
    }
  });

  it('gives continue-learning rows the same treatment as one-hop rows', async () => {
    const entity = normalizeEntity(fullEntityFixture('place'))!;
    const continueLearning = entity.continueLearning ?? [];
    expect(continueLearning.length).toBeGreaterThan(0);
    const { getByTestId } = await render(
      <RelatedSection
        relatedNeighbors={entity.relatedNeighbors ?? []}
        continueLearning={continueLearning}
        index="08"
      />,
    );
    for (const neighbor of continueLearning) {
      expect(
        getByTestId(`entity-related-meter-${neighbor.id}`, { includeHiddenElements: true }),
      ).toBeTruthy();
    }
  });
});
