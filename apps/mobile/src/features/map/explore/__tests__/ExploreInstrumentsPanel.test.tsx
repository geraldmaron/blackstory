/**
 * Tests for embedded v6 Explore instruments panel — tabbed Filters | Color key.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import { SEPARATED } from '@/features/explore/__fixtures__/features';
import { ExploreInstrumentsPanel } from '../ExploreInstrumentsPanel';

describe('ExploreInstrumentsPanel', () => {
  it('renders Filters tab by default with facet rows', async () => {
    const { getByTestId, getByText } = await render(
      <ExploreInstrumentsPanel
        filters={{}}
        features={SEPARATED}
        onFiltersChange={() => undefined}
        onHide={() => undefined}
      />,
    );
    expect(getByTestId('explore-instruments-panel')).toBeTruthy();
    expect(getByTestId('explore-filters-panel')).toBeTruthy();
    expect(getByText('Filters')).toBeTruthy();
    expect(getByText('Color key')).toBeTruthy();
  });

  it('switches to Color key tab', async () => {
    const { getByLabelText, getByTestId, queryByTestId } = await render(
      <ExploreInstrumentsPanel
        filters={{}}
        features={SEPARATED}
        onFiltersChange={() => undefined}
        onHide={() => undefined}
      />,
    );
    await act(async () => {
      fireEvent.press(getByLabelText('Color key'));
    });
    expect(getByTestId('explore-instruments-color-key')).toBeTruthy();
    expect(queryByTestId('explore-instruments-filters')).toBeNull();
  });

  it('auto-applies kind filter changes', async () => {
    const onFiltersChange = jest.fn();
    const { getByLabelText } = await render(
      <ExploreInstrumentsPanel
        filters={{}}
        features={SEPARATED}
        onFiltersChange={onFiltersChange}
        onHide={() => undefined}
      />,
    );
    fireEvent.press(getByLabelText('Places'));
    expect(onFiltersChange).toHaveBeenCalledWith({ kind: 'places' });
  });
});
