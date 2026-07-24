/**
 * Explore floating mast count labels — viewport list size plus loaded release total.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { ExploreFloatingChrome } from '../ExploreFloatingChrome';

const noop = () => {};

describe('ExploreFloatingChrome — mast count scope', () => {
  it('labels the pre-viewport count as all records', async () => {
    const { getByTestId } = await render(
      <ExploreFloatingChrome
        inViewCount={3}
        releaseCount={3}
        scopeLabel="All records"
        filters={{}}
        onToggleInstruments={noop}
        onNationalView={noop}
      />,
    );
    const mast = getByTestId('explore-mast-count');
    expect(mast.props.accessibilityLabel).toBe('All records, 3 records');
    expect(mast).toHaveTextContent('3 pinned');
  });

  it('shows dual copy when viewport-scoped count differs from release total', async () => {
    const { getByTestId } = await render(
      <ExploreFloatingChrome
        inViewCount={712}
        releaseCount={1365}
        scopeLabel="In view"
        filters={{}}
        onToggleInstruments={noop}
        onNationalView={noop}
      />,
    );
    const mast = getByTestId('explore-mast-count');
    expect(mast.props.accessibilityLabel).toBe('In view, 712 in view, 1,365 in release');
    // The mast chip uses the compact rail copy (no second "in view") so the
    // honest "in release" total is never the part that gets truncated.
    expect(mast).toHaveTextContent('712 / 1,365');
  });

  it('reflects active filters without changing scope semantics', async () => {
    const { getByTestId } = await render(
      <ExploreFloatingChrome
        inViewCount={2}
        releaseCount={1365}
        scopeLabel="In view"
        filters={{ kind: 'place' }}
        onToggleInstruments={noop}
        onNationalView={noop}
      />,
    );
    const mast = getByTestId('explore-mast-count');
    expect(mast.props.accessibilityLabel).toBe('In view, 2 in view · filtered, 1,365 in release');
    expect(mast).toHaveTextContent('2 / 1,365');
  });

  it('toggles instruments from the ghost control', async () => {
    const onToggleInstruments = jest.fn();
    const { getByTestId } = await render(
      <ExploreFloatingChrome
        inViewCount={1}
        releaseCount={1}
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
