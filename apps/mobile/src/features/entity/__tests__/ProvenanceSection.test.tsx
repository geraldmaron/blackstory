/**
 * Provenance beat: labeled rows, a coverage meter, and no vocabulary lecture.
 */
import { render } from '@testing-library/react-native';

import { ProvenanceSection } from '../sections/ProvenanceSection';
import { normalizeEntity } from '../normalize';
import { fullEntityFixture } from '../testFixtures';

describe('ProvenanceSection', () => {
  it('states maturity and coverage as fields, not as a sentence', async () => {
    const entity = normalizeEntity(fullEntityFixture('place'))!;
    const { getByTestId, queryByText } = await render(
      <ProvenanceSection entity={entity} index="09" />,
    );

    expect(getByTestId('entity-provenance-maturity')).toBeTruthy();
    expect(getByTestId('entity-provenance-coverage')).toBeTruthy();
    // The beat used to explain its own vocabulary to the reader. That sentence addressed the
    // archive, not anyone reading the record.
    expect(queryByText(/product constitution vocabulary/i)).toBeNull();
    expect(queryByText(/^Maturity: /)).toBeNull();
  });

  it('draws the shared meter for research coverage', async () => {
    const entity = normalizeEntity(fullEntityFixture('place'))!;
    const { getByTestId } = await render(<ProvenanceSection entity={entity} index="09" />);
    expect(
      getByTestId('entity-provenance-coverage-meter', { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it('keeps the revision dates as labeled rows', async () => {
    const entity = normalizeEntity(fullEntityFixture('place'))!;
    const { getByTestId } = await render(<ProvenanceSection entity={entity} index="09" />);
    expect(getByTestId('entity-provenance-updated')).toBeTruthy();
    expect(getByTestId('entity-provenance-generated')).toBeTruthy();
  });
});
