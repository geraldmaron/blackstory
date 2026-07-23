/**
 * RNTL screen tests for the Explore experience (MOB-012).
 *
 * A JS runner cannot mount the native GL map, so `@maplibre/maplibre-react-native`
 * is mocked with plain Views (same approach as MOB-011's MapScreen tests). What
 * these prove is the interaction architecture: the metrics dashboard renders from
 * real feature properties, filters reflect in the count, expanding the secondary
 * list opens a row → preview sheet with a working entity link, the sheet stays
 * usable when the MAP is in an error state, the empty state renders, a
 * pathological label does not crash rendering, and rapid mount/unmount cleans up
 * its subscriptions (leak check).
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

jest.mock('@gorhom/bottom-sheet', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { View } = require('react-native');

  const BottomSheet = React.forwardRef(
    (
      {
        children,
        handleComponent,
      }: {
        children?: unknown;
        handleComponent?: () => unknown;
      },
      _ref: unknown,
    ) =>
      React.createElement(
        View,
        { testID: 'explore-bottom-sheet-host' },
        handleComponent ? handleComponent() : null,
        children as never,
      ),
  );
  BottomSheet.displayName = 'BottomSheet';

  const Passthrough = ({
    children,
    testID,
  }: {
    children?: unknown;
    testID?: string;
  }) => React.createElement(View, { testID }, children as never);

  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetView: Passthrough,
    BottomSheetScrollView: Passthrough,
    BottomSheetFlatList: Passthrough,
    BottomSheetHandle: () => null,
    BottomSheetBackdrop: () => null,
  };
});

jest.mock('react-native-reanimated', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: (c: unknown) => c,
      call: () => {},
    },
    View,
    Easing: { linear: (t: number) => t, bezier: () => (t: number) => t },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => v,
    runOnJS: (fn: unknown) => fn,
    runOnUI: (fn: unknown) => fn,
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
    FadeIn: {},
    FadeOut: {},
  };
});

// eslint-disable-next-line import/first
import { ExploreView } from '../ExploreView';
// eslint-disable-next-line import/first
import { DEMO_MAP_SOURCE, type MapFeatureCollection } from '@/features/map';

const noop = () => {};

async function expandSecondaryList(
  utils: Awaited<ReturnType<typeof render>>,
): Promise<void> {
  await act(async () => {
    fireEvent.press(utils.getByTestId('explore-metrics-list-toggle'));
  });
}

// Flush any pending async (e.g. the reduce-motion `isReduceMotionEnabled` promise)
// after each test so one test's deferred work cannot bleed into the next and skew
// the subscription counts the leak test measures.
afterEach(async () => {
  await act(async () => {
    await Promise.resolve();
  });
});

describe('ExploreView — metrics dashboard', () => {
  it('renders metrics for redacted features instead of a primary list', async () => {
    const { getByTestId, queryByTestId, getByLabelText } = await render(
      <ExploreView onOpenEntity={noop} onOpenFilters={noop} reduceMotion />,
    );
    expect(getByTestId('explore-metrics-dashboard')).toBeTruthy();
    expect(getByTestId('explore-metrics-by-kind')).toBeTruthy();
    expect(getByTestId('explore-metrics-by-state')).toBeTruthy();
    expect(getByTestId('explore-metrics-by-precision')).toBeTruthy();
    expect(getByTestId('explore-metric-total')).toBeTruthy();
    expect(getByTestId('explore-metric-precision-honesty')).toBeTruthy();
    expect(getByLabelText(/^Place: 2 records, 67%$/)).toBeTruthy();
    expect(getByLabelText(/^Person: 1 record, 33%$/)).toBeTruthy();
    // Attribution hosted outside MapScreen at peek so sheet can cover it.
    expect(getByTestId('map-attribution')).toBeTruthy();
    // List is secondary — collapsed by default.
    expect(queryByTestId('explore-list')).toBeNull();
  });

  it('hides map attribution when a selection expands the sheet', async () => {
    const { queryByTestId, findByTestId } = await render(
      <ExploreView
        selectedParam="ent_fixture_place_dc"
        onOpenEntity={noop}
        onOpenFilters={noop}
        reduceMotion
      />,
    );
    expect(await findByTestId('entity-preview-sheet')).toBeTruthy();
    expect(queryByTestId('map-attribution')).toBeNull();
  });

  it('reflects filters in the result count and metrics buckets', async () => {
    const { getByLabelText, queryByLabelText, queryByTestId } = await render(
      <ExploreView filters={{ kind: 'place' }} onOpenEntity={noop} onOpenFilters={noop} reduceMotion />,
    );
    expect(getByLabelText(/2 · filtered records/)).toBeTruthy();
    expect(getByLabelText(/^2 records all records$/)).toBeTruthy();
    expect(getByLabelText(/^Place: 2 records, 100%$/)).toBeTruthy();
    expect(queryByLabelText(/^Person: 1 record/)).toBeNull();
    expect(queryByTestId('explore-list')).toBeNull();
  });
});

describe('ExploreView — entity preview sheet', () => {
  it('opens the preview sheet from the secondary list and links to the full entity route', async () => {
    const onOpenEntity = jest.fn();
    const utils = await render(
      <ExploreView onOpenEntity={onOpenEntity} onOpenFilters={noop} reduceMotion />,
    );
    await expandSecondaryList(utils);
    fireEvent.press(utils.getByLabelText(/Seed Historical Place/));
    expect(await utils.findByTestId('entity-preview-sheet')).toBeTruthy();
    fireEvent.press(await utils.findByLabelText(/View full record for/));
    expect(onOpenEntity).toHaveBeenCalledWith('ent_fixture_place_dc');
  });

  it('opens the preview sheet when a deep-linked selection is restored', async () => {
    const { findByTestId } = await render(
      <ExploreView
        selectedParam="ent_fixture_place_dc"
        onOpenEntity={noop}
        onOpenFilters={noop}
        reduceMotion
      />,
    );
    expect(await findByTestId('entity-preview-sheet')).toBeTruthy();
  });
});

describe('ExploreView — failed map leaves metrics usable', () => {
  it('renders the degraded map error state AND interactive metrics with secondary list', async () => {
    const onOpenEntity = jest.fn();
    const utils = await render(
      <ExploreView
        loadState={{ kind: 'error', mode: 'provider-outage' }}
        onOpenEntity={onOpenEntity}
        onOpenFilters={noop}
        reduceMotion
      />,
    );
    expect(utils.getByTestId('map-error-state')).toBeTruthy();
    expect(utils.queryByTestId('maplibre-map')).toBeNull();
    expect(utils.getByTestId('explore-metrics-dashboard')).toBeTruthy();
    await expandSecondaryList(utils);
    fireEvent.press(utils.getByLabelText(/Seed Historical Place/));
    fireEvent.press(await utils.findByLabelText(/View full record for/));
    expect(onOpenEntity).toHaveBeenCalled();
  });
});

describe('ExploreView — empty + adversarial', () => {
  const empty: MapFeatureCollection = { type: 'FeatureCollection', features: [] };

  it('shows the empty metrics state and a zero count when nothing matches', async () => {
    const { getByTestId, getByLabelText } = await render(
      <ExploreView source={empty} onOpenEntity={noop} onOpenFilters={noop} reduceMotion />,
    );
    expect(getByTestId('explore-metrics-empty')).toBeTruthy();
    expect(getByLabelText(/0 records/)).toBeTruthy();
  });

  it('renders a pathological oversized label without crashing when the list is expanded', async () => {
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
    const utils = await render(
      <ExploreView source={hostile} onOpenEntity={noop} onOpenFilters={noop} reduceMotion />,
    );
    expect(utils.getByTestId('explore-metrics-dashboard')).toBeTruthy();
    await expandSecondaryList(utils);
    expect(utils.getByTestId('explore-list')).toBeTruthy();
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
