/**
 * Explore floating mast count labels — must stay aligned with the records rail scope
 * (viewport-clipped visible set, not the full filtered atlas).
 */
import { fireEvent, render } from '@testing-library/react-native';
import { ExploreFloatingChrome } from '../ExploreFloatingChrome';

const noop = () => {};

describe('ExploreFloatingChrome — mast count scope', () => {
  it('labels the pre-viewport count as all records', async () => {
    const { getByTestId } = await render(
      <ExploreFloatingChrome
        visibleCount={3}
        scopeLabel="All records"
        filters={{}}
        onToggleInstruments={noop}
        onNationalView={noop}
      />,
    );
    const mast = getByTestId('explore-mast-count');
    expect(mast.props.accessibilityLabel).toBe('All records, 3 records');
    expect(mast).toHaveTextContent('3 records');
  });

  it('labels the viewport-scoped count as in view', async () => {
    const { getByTestId } = await render(
      <ExploreFloatingChrome
        visibleCount={768}
        scopeLabel="In view"
        filters={{}}
        onToggleInstruments={noop}
        onNationalView={noop}
      />,
    );
    const mast = getByTestId('explore-mast-count');
    expect(mast.props.accessibilityLabel).toBe('In view, 768 records');
    expect(mast).toHaveTextContent('768 records in view');
  });

  it('reflects active filters without changing scope semantics', async () => {
    const { getByTestId } = await render(
      <ExploreFloatingChrome
        visibleCount={2}
        scopeLabel="In view"
        filters={{ kind: 'place' }}
        onToggleInstruments={noop}
        onNationalView={noop}
      />,
    );
    const mast = getByTestId('explore-mast-count');
    expect(mast.props.accessibilityLabel).toBe('In view, 2 records · filtered');
    expect(mast).toHaveTextContent('2 · filtered records in view');
  });

  it('toggles instruments from the ghost control', async () => {
    const onToggleInstruments = jest.fn();
    const { getByTestId } = await render(
      <ExploreFloatingChrome
        visibleCount={1}
        scopeLabel="All records"
        filters={{}}
        onToggleInstruments={onToggleInstruments}
        onNationalView={noop}
      />,
    );
    fireEvent.press(getByTestId('explore-chip-instruments'));
    expect(onToggleInstruments).toHaveBeenCalledTimes(1);
  });
});
