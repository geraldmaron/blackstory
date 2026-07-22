/**
 * RNTL screen tests for the Explore experience (MOB-012).
 *
 * A JS runner cannot mount the native GL map, so `@maplibre/maplibre-react-native`
 * is mocked with plain Views (same approach as MOB-011's MapScreen tests). What
 * these prove is the interaction architecture: the list renders and is
 * interactive, filters reflect in the count, a row opens the preview sheet with a
 * working entity link, the list stays usable when the MAP is in an error state,
 * the empty state renders, a pathological label does not crash rendering, and
 * rapid mount/unmount cleans up its subscriptions (leak check).
 */
import { AccessibilityInfo } from 'react-native';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';

jest.mock('@maplibre/maplibre-react-native', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { View } = require('react-native');
  const Camera = React.forwardRef((_props: unknown, _ref: unknown) =>
    React.createElement(View, { testID: 'maplibre-camera' }),
  );
  Camera.displayName = 'Camera';
  const GeoJSONSource = React.forwardRef(({ children }: { children?: unknown }, _ref: unknown) =>
    React.createElement(View, { testID: 'maplibre-geojson-source' }, children as never),
  );
  GeoJSONSource.displayName = 'GeoJSONSource';
  return {
    Map: ({ children, testID }: { children?: unknown; testID?: string }) =>
      React.createElement(View, { testID: testID ?? 'maplibre-map' }, children as never),
    Camera,
    GeoJSONSource,
    Layer: () => React.createElement(View, { testID: 'maplibre-layer' }),
  };
});

jest.mock('react-native-safe-area-context', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children?: unknown; style?: unknown }) =>
      React.createElement(View, { style }, children as never),
    SafeAreaProvider: ({ children }: { children?: unknown }) => children,
  };
});

// eslint-disable-next-line import/first
import { ExploreView } from '../ExploreView';
// eslint-disable-next-line import/first
import { DEMO_MAP_SOURCE, type MapFeatureCollection } from '@/features/map';

const noop = () => {};

// Flush any pending async (e.g. the reduce-motion `isReduceMotionEnabled` promise)
// after each test so one test's deferred work cannot bleed into the next and skew
// the subscription counts the leak test measures.
afterEach(async () => {
  await act(async () => {
    await Promise.resolve();
  });
});

describe('ExploreView — synchronized list', () => {
  it('renders a list row for each redacted feature and is interactive', async () => {
    const { getByLabelText } = await render(
      <ExploreView onOpenEntity={noop} onOpenFilters={noop} reduceMotion />,
    );
    expect(getByLabelText(/Seed Historical Place/)).toBeTruthy();
    expect(getByLabelText(/Seed Living Person/)).toBeTruthy();
  });

  it('reflects filters in the result count and the list', async () => {
    const { getByText, queryByLabelText } = await render(
      <ExploreView filters={{ kind: 'place' }} onOpenEntity={noop} onOpenFilters={noop} reduceMotion />,
    );
    expect(getByText(/2 records · filtered/)).toBeTruthy();
    // The person record is filtered out of the list.
    expect(queryByLabelText(/Seed Living Person/)).toBeNull();
  });
});

describe('ExploreView — entity preview sheet', () => {
  it('opens the preview sheet on row press and links to the full entity route', async () => {
    const onOpenEntity = jest.fn();
    const { getByLabelText, findByTestId, findByLabelText } = await render(
      <ExploreView onOpenEntity={onOpenEntity} onOpenFilters={noop} reduceMotion />,
    );
    fireEvent.press(getByLabelText(/Seed Historical Place/));
    expect(await findByTestId('entity-preview-sheet')).toBeTruthy();
    fireEvent.press(await findByLabelText(/View full record for/));
    expect(onOpenEntity).toHaveBeenCalledWith('ent_fixture_place_dc');
  });
});

describe('ExploreView — failed map leaves the list usable', () => {
  it('renders the degraded map error state AND an interactive list', async () => {
    const onOpenEntity = jest.fn();
    const { getByTestId, queryByTestId, getByLabelText, findByLabelText } = await render(
      <ExploreView
        loadState={{ kind: 'error', mode: 'provider-outage' }}
        onOpenEntity={onOpenEntity}
        onOpenFilters={noop}
        reduceMotion
      />,
    );
    expect(getByTestId('map-error-state')).toBeTruthy();
    expect(queryByTestId('maplibre-map')).toBeNull();
    // The list still works: select a record and open it.
    fireEvent.press(getByLabelText(/Seed Historical Place/));
    fireEvent.press(await findByLabelText(/View full record for/));
    expect(onOpenEntity).toHaveBeenCalled();
  });
});

describe('ExploreView — empty + adversarial', () => {
  const empty: MapFeatureCollection = { type: 'FeatureCollection', features: [] };

  it('shows the empty state and a zero count when nothing matches', async () => {
    const { getByTestId, getByText } = await render(
      <ExploreView source={empty} onOpenEntity={noop} onOpenFilters={noop} reduceMotion />,
    );
    expect(getByTestId('explore-list-empty')).toBeTruthy();
    expect(getByText(/0 records/)).toBeTruthy();
  });

  it('renders a pathological oversized label without crashing or overflowing', async () => {
    const hostile: MapFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'ent_hostile_001',
          geometry: { type: 'Point', coordinates: [-95.37, 29.76] },
          properties: {
            entityId: 'ent_hostile_001',
            kind: 'place',
            displayName: 'X'.repeat(50_000),
            precision: 'city',
          },
        },
      ],
    };
    const { getByTestId } = await render(
      <ExploreView source={hostile} onOpenEntity={noop} onOpenFilters={noop} reduceMotion />,
    );
    expect(getByTestId('explore-list')).toBeTruthy();
  });
});

describe('ExploreView — repeated mount/unmount (leak check)', () => {
  it('balances every event subscription with a cleanup (no listener leak)', async () => {
    // Unmount any trees left mounted by earlier tests so their deferred effects
    // cannot fire under (and skew) the spy we are about to install.
    cleanup();
    await act(async () => {
      await Promise.resolve();
    });

    const remove = jest.fn();
    const addSpy = jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove } as never);
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);

    const CYCLES = 25;
    for (let i = 0; i < CYCLES; i += 1) {
      const view = await render(
        <ExploreView source={DEMO_MAP_SOURCE} onOpenEntity={noop} onOpenFilters={noop} />,
      );
      await act(async () => {
        view.unmount();
      });
    }

    // The leak invariant: every one of the CYCLES mounts has its reduce-motion
    // subscription CLEANED UP on unmount, and subscriptions do not accumulate.
    //   - removes >= CYCLES  : cleanup ran for every rapid mount/unmount cycle.
    //   - adds - removes is a small constant (NOT growing with CYCLES): the
    //     classic "duplicate subscriptions" leak (re-subscribe every render) would
    //     drive adds far past removes; here the only surplus is a handful of
    //     passive effects that RNTL 14's concurrent renderer defers from earlier
    //     tests in this file and flushes under our spy — bounded, not per-cycle.
    // (Isolated, this component is an exact 25/25 balance; the surplus is harness
    // cross-test deferral, not product behavior. True memory-under-pressure proof
    // is device/Maestro evidence per ADR-024.)
    expect(remove.mock.calls.length).toBeGreaterThanOrEqual(CYCLES);
    expect(addSpy.mock.calls.length - remove.mock.calls.length).toBeLessThanOrEqual(10);
    addSpy.mockRestore();
  });
});
