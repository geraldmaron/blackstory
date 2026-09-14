/**
 * "Cited in": the record side of the story-record link, and its empty-state rule.
 *
 * The rule under test is that the beat DISAPPEARS when no story cites the record — deliberately
 * unlike the sparse beats around it, which show `RecordGapNotice`. Most of the catalog has no
 * long-form written about it, so a permanent notice would name a gap in the archive's writing on
 * every record that has none, which reads as an accusation against the record.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { CitedInSection } from '../sections/CitedInSection';
import { EntityDetailScreen } from '../EntityDetailScreen';
import { normalizeEntity } from '../normalize';
import { fullEntityFixture } from '../testFixtures';

const READY = (raw: Record<string, unknown>) => ({
  kind: 'ready' as const,
  result: {
    status: 'ready' as const,
    entity: normalizeEntity(raw)!,
    freshness: { source: 'network' as const, fetchedAt: Date.now(), degraded: false },
  },
});

describe('CitedInSection', () => {
  it('lists each citing story with the relation stated in words', async () => {
    const entity = normalizeEntity(fullEntityFixture('place'))!;
    const { getByTestId, getByText } = await render(
      <CitedInSection citingStories={entity.citingStories ?? []} index="09" />,
    );
    expect(getByTestId('entity-cited-in-section')).toBeTruthy();
    expect(getByText('Blockbusting')).toBeTruthy();
    expect(getByText('mapped in')).toBeTruthy();
    expect(getByText('Zoning')).toBeTruthy();
    expect(getByText('referenced in')).toBeTruthy();
  });

  it('renders nothing at all when no story cites the record', async () => {
    const { queryByTestId } = await render(<CitedInSection citingStories={[]} index="09" />);
    expect(queryByTestId('entity-cited-in-section')).toBeNull();
  });

  it('opens a story by slug, never by the site href', async () => {
    const entity = normalizeEntity(fullEntityFixture('place'))!;
    const onOpenStory = jest.fn();
    const { getByLabelText } = await render(
      <CitedInSection
        citingStories={entity.citingStories ?? []}
        index="09"
        onOpenStory={onOpenStory}
      />,
    );
    fireEvent.press(getByLabelText(/Blockbusting, mapped in this record/i));
    expect(onOpenStory).toHaveBeenCalledWith('blockbusting');
  });
});

describe('EntityDetailScreen — the cited-in beat', () => {
  it('places the beat between connected records and provenance', async () => {
    const { getByTestId } = await render(
      <EntityDetailScreen state={READY(fullEntityFixture('place'))} />,
    );
    expect(getByTestId('entity-connected-section')).toBeTruthy();
    expect(getByTestId('entity-cited-in-section')).toBeTruthy();
    expect(getByTestId('entity-provenance-section')).toBeTruthy();
  });

  it('omits the beat entirely on a record no story cites', async () => {
    const raw = fullEntityFixture('place');
    delete raw.citingStories;
    const { queryByTestId, getByTestId } = await render(<EntityDetailScreen state={READY(raw)} />);
    expect(queryByTestId('entity-cited-in-section')).toBeNull();
    // The record itself is unaffected — no gap notice takes the beat's place.
    expect(getByTestId('entity-provenance-section')).toBeTruthy();
  });
});
