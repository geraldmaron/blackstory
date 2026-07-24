/**
 * Explore floating mast count labels — viewport list size plus loaded release total.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { ExploreFloatingChrome } from '../ExploreFloatingChrome';

const noop = () => {};

describe('ExploreFloatingChrome — mast count scope', () => {
  it('labels the pre-viewport count as all pinned', async () => {
    const { getByTestId } = await render(
      <ExploreFloatingChrome
        inViewCount={3}
        releaseCount={3}
        scopeLabel="All pinned"
        filters={{}}
        onToggleInstruments={noop}
        onNationalView={noop}
      />,
    );
    const mast = getByTestId('explore-mast-count');
    expect(mast.props.accessibilityLabel).toBe('All pinned, 3 pinned');
    expect(mast).toHaveTextContent(/3 pinned/);
  });

  it('shows dual copy when viewport-scoped count differs from release total', async () => {
    const { getByTestId } = await render(
      <ExploreFloatingChrome
        inViewCount={712}
        releaseCount={1365}
        scopeLabel="Nearby"
        filters={{}}
        onToggleInstruments={noop}
        onNationalView={noop}
      />,
    );
    const mast = getByTestId('explore-mast-count');
    expect(mast.props.accessibilityLabel).toBe('Nearby, 712 nearby, 1,365 in release');
    // The mast chip uses the compact rail copy (no second "nearby") so the
    // honest "in release" total is never the part that gets truncated.
    expect(mast).toHaveTextContent(/712 \/ 1,365/);
  });

  it('reflects active filters without changing scope semantics', async () => {
    const { getByTestId } = await render(
      <ExploreFloatingChrome
        inViewCount={2}
        releaseCount={1365}
        scopeLabel="Nearby"
        filters={{ kind: 'place' }}
        onToggleInstruments={noop}
        onNationalView={noop}
      />,
    );
    const mast = getByTestId('explore-mast-count');
    expect(mast.props.accessibilityLabel).toBe('Nearby, 2 nearby · filtered, 1,365 in release');
    expect(mast).toHaveTextContent(/2 \/ 1,365/);
  });

  it('toggles instruments from the ghost control', async () => {
    const onToggleInstruments = jest.fn();
    const { getByTestId } = await render(
      <ExploreFloatingChrome
        inViewCount={1}
        releaseCount={1}
        scopeLabel="All pinned"
        filters={{}}
        onToggleInstruments={onToggleInstruments}
        onNationalView={noop}
      />,
    );
    fireEvent.press(getByTestId('explore-chip-instruments'));
    expect(onToggleInstruments).toHaveBeenCalledTimes(1);
  });

  it('exposes search, instruments, records, and national ghost controls', async () => {
    const { getByLabelText } = await render(
      <ExploreFloatingChrome
        inViewCount={1}
        releaseCount={1}
        scopeLabel="All pinned"
        filters={{}}
        onToggleInstruments={noop}
        onToggleRecords={noop}
        onNationalView={noop}
        onOpenSearch={noop}
      />,
    );
    expect(getByLabelText('Open search')).toBeTruthy();
    expect(getByLabelText('Open map filters')).toBeTruthy();
    expect(getByLabelText('Expand records rail')).toBeTruthy();
    expect(getByLabelText('Reset to national view')).toBeTruthy();
  });

  it('marks instruments selected and badges when any filter facet is active', async () => {
    const { getByTestId, getByLabelText } = await render(
      <ExploreFloatingChrome
        inViewCount={2}
        releaseCount={10}
        scopeLabel="Nearby"
        filters={{ confidence: 'high' }}
        onToggleInstruments={noop}
        onNationalView={noop}
      />,
    );
    expect(getByLabelText('Map instruments, 1 filter active')).toBeTruthy();
    expect(
      getByTestId('explore-chip-instruments-badge', { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it('shows sparse viewport coach when the release has pins but the view has none', async () => {
    const { getByTestId, queryByTestId, rerender } = await render(
      <ExploreFloatingChrome
        inViewCount={0}
        releaseCount={1365}
        scopeLabel="Nearby"
        filters={{}}
        onToggleInstruments={noop}
        onNationalView={noop}
      />,
    );
    expect(getByTestId('explore-sparse-viewport-coach')).toBeTruthy();
    expect(getByTestId('explore-sparse-viewport-coach')).toHaveTextContent(/No pins in this view/);

    await rerender(
      <ExploreFloatingChrome
        inViewCount={12}
        releaseCount={1365}
        scopeLabel="Nearby"
        filters={{}}
        onToggleInstruments={noop}
        onNationalView={noop}
      />,
    );
    expect(queryByTestId('explore-sparse-viewport-coach')).toBeNull();
  });
});
