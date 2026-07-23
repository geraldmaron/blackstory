/**
 * Record anatomy section: v6 edition panel, fact grid, place preview, maps hand-off.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { AnatomySection } from '../sections/AnatomySection';
import { normalizeEntity } from '../normalize';
import { fullEntityFixture, minimalEntityFixture } from '../testFixtures';

describe('AnatomySection', () => {
  it('renders four labeled facts inside the anatomy edition panel', async () => {
    const entity = normalizeEntity(fullEntityFixture('place'))!;
    const { getByTestId, getByText } = await render(<AnatomySection entity={entity} />);
    expect(getByTestId('entity-anatomy-section')).toBeTruthy();
    expect(getByText('Record at a glance')).toBeTruthy();
    expect(getByText('ANATOMY')).toBeTruthy();
    expect(getByText('Kind')).toBeTruthy();
    expect(getByText('Where')).toBeTruthy();
    expect(getByText('Era')).toBeTruthy();
    expect(getByText('Evidence')).toBeTruthy();
    expect(getByText('Place')).toBeTruthy();
    expect(getByText('Reconstruction')).toBeTruthy();
    expect(getByText(/Grade A · 2 sources/)).toBeTruthy();
  });

  it('shows Place not pinned when geo is absent', async () => {
    const entity = normalizeEntity(minimalEntityFixture('place'))!;
    const { getByTestId, getByText } = await render(<AnatomySection entity={entity} />);
    expect(getByTestId('record-place-empty')).toBeTruthy();
    expect(getByText('Place not pinned')).toBeTruthy();
    expect(getByText('Undated')).toBeTruthy();
  });

  it('offers Open in maps and View on national map when geo exists', async () => {
    const onBackToMap = jest.fn();
    const entity = normalizeEntity(fullEntityFixture('place'))!;
    const { getAllByLabelText, getByLabelText } = await render(
      <AnatomySection entity={entity} onBackToMap={onBackToMap} />,
    );
    expect(getAllByLabelText(/Open Historic Dunbar neighborhood in Maps/).length).toBeGreaterThan(0);
    fireEvent.press(getByLabelText(/View Full Fixture Record \(place\) on the national map/));
    expect(onBackToMap).toHaveBeenCalledTimes(1);
  });
});
