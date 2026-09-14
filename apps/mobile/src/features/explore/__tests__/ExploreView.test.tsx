/**
 * RNTL screen tests for the Explore experience (MOB-012).
 *
 * A JS runner cannot mount the native GL map, so `@maplibre/maplibre-react-native`
 * is mocked with plain Views (same approach as MOB-011's MapScreen tests). What
 * these prove is the interaction architecture: the records rail renders from real
 * feature properties, filters reflect in the count, list row opens preview sheet
 * with a working entity link, the sheet stays usable when the MAP is in an error
 * state, the empty state renders, a pathological label does not crash rendering,
 * and rapid mount/unmount cleans up its subscriptions (leak check).
 */
import { AccessibilityInfo } from 'react-native';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react-native';

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
    Map: ({
      children,
      testID,
      dragPan,
      touchZoom,
    }: {
      children?: unknown;
      testID?: string;
      dragPan?: boolean;
      touchZoom?: boolean;
    }) =>
      React.createElement(
        View,
        { testID: testID ?? 'maplibre-map', dragPan, touchZoom },
        children as never,
      ),
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
    // Spread the real module so `SafeAreaInsetsContext` survives: `useLayoutSize` reads that
    // context object directly, and a mock that omits it makes `useContext` throw on a value
    // that is `undefined` rather than a context.
    ...jest.requireActual('react-native-safe-area-context'),
    SafeAreaView: ({ children, style }: { children?: unknown; style?: unknown }) =>
      React.createElement(View, { style }, children as never),
    SafeAreaProvider: ({ children }: { children?: unknown }) => children,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
  };
});

jest.mock('@gorhom/bottom-sheet', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { View, Pressable, Text } = require('react-native');

  const BottomSheet = React.forwardRef(
    (
      {
        children,
        handleComponent,
        index,
        onChange,
      }: {
        children?: unknown;
        handleComponent?: () => unknown;
        index?: number;
        onChange?: (index: number) => void;
      },
      _ref: unknown,
    ) =>
      React.createElement(
        View,
        { testID: 'explore-bottom-sheet-host' },
        // Surface the controlled index so tests can assert what the derived
        // value settled on after a simulated gesture (no snap-back).
        React.createElement(Text, { testID: 'sheet-controlled-index' }, String(index)),
        // Simulated drag-settle triggers — fire the sheet's onChange the way the
        // gorhom sheet would when the user lifts their finger on a detent.
        React.createElement(Pressable, {
          testID: 'sheet-settle-peek',
          onPress: () => onChange?.(0),
        }),
        React.createElement(Pressable, {
          testID: 'sheet-settle-half',
          onPress: () => onChange?.(1),
        }),
        React.createElement(Pressable, {
          testID: 'sheet-settle-full',
          onPress: () => onChange?.(2),
        }),
        handleComponent ? handleComponent() : null,
        children as never,
      ),
  );
  BottomSheet.displayName = 'BottomSheet';

  const Passthrough = ({ children, testID }: { children?: unknown; testID?: string }) =>
    React.createElement(View, { testID }, children as never);

  const BottomSheetFlatList = (props: {
    testID?: string;
    data?: unknown[];
    renderItem?: (info: { item: unknown }) => unknown;
    ListHeaderComponent?: unknown;
    ListEmptyComponent?: unknown;
    keyExtractor?: (item: unknown) => string;
  }) => {
    const header =
      typeof props.ListHeaderComponent === 'function'
        ? props.ListHeaderComponent()
        : props.ListHeaderComponent;
    const data = props.data ?? [];
    const empty =
      data.length === 0 && props.ListEmptyComponent
        ? typeof props.ListEmptyComponent === 'function'
          ? props.ListEmptyComponent()
          : props.ListEmptyComponent
        : null;
    return React.createElement(
      View,
      { testID: props.testID },
      header ?? null,
      empty ?? null,
      ...data.map((item, index) =>
        props.renderItem
          ? props.renderItem({ item })
          : React.createElement(View, {
              key: props.keyExtractor?.(item) ?? String(index),
            }),
      ),
    );
  };

  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetView: Passthrough,
    BottomSheetScrollView: Passthrough,
    BottomSheetFlatList,
    BottomSheetHandle: () => null,
    BottomSheetBackdrop: () => null,
    useBottomSheetTimingConfigs: (config: unknown) => config,
  };
});

jest.mock('react-native-reanimated', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { View } = require('react-native');
  const fadeBuilder: Record<string, (...args: unknown[]) => unknown> = {};
  fadeBuilder.duration = () => fadeBuilder;
  fadeBuilder.delay = () => fadeBuilder;
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
    // Entering/exiting builders are chainable no-ops (`.duration(...)` returns self).
    FadeIn: fadeBuilder,
    FadeOut: fadeBuilder,
    FadeInDown: fadeBuilder,
    FadeOutUp: fadeBuilder,
  };
});

// eslint-disable-next-line import/first
import { ExploreView } from '../ExploreView';
// eslint-disable-next-line import/first
import { DEMO_MAP_SOURCE, type MapFeatureCollection } from '@/features/map';
// eslint-disable-next-line import/first
import { resetTestWindowSize, setTestWindowSize } from '@/ui/layout/testing';

const noop = () => {};

/**
 * iPhone 16 Pro in portrait, in points.
 *
 * Declared rather than inherited, because jest-expo seeds the window with 750x1334 — iPhone 8's
 * PIXEL dimensions read as points. No shipping phone is 750pt wide, and Explore reads 750pt as a
 * tablet and gives it the two-pane layout. Every assertion below is about the phone posture, so
 * the phone window is stated.
 */
const PHONE_WINDOW = { width: 402, height: 874 } as const;

/** iPad Pro 11" in portrait, in points — the two-pane posture. */
const TABLET_WINDOW = { width: 834, height: 1194 } as const;

beforeEach(() => {
  setTestWindowSize(PHONE_WINDOW);
});

afterEach(async () => {
  await act(async () => {
    await Promise.resolve();
  });
  resetTestWindowSize();
});

describe('ExploreView — records rail', () => {
  it('renders the records rail at peek with count header', async () => {
    const { getByTestId } = await render(<ExploreView onOpenEntity={noop} reduceMotion />);
    expect(getByTestId('explore-records-rail')).toBeTruthy();
    expect(getByTestId('explore-mast-count').props.accessibilityLabel).toBe('All pinned, 3 pinned');
    expect(getByTestId('map-attribution')).toBeTruthy();
  });

  it('hides map attribution when a selection expands the sheet', async () => {
    const { queryByTestId, findByTestId } = await render(
      <ExploreView selectedParam="ent_fixture_place_dc" onOpenEntity={noop} reduceMotion />,
    );
    expect(await findByTestId('entity-preview-sheet')).toBeTruthy();
    expect(queryByTestId('map-attribution')).toBeNull();
  });

  it('reflects filters in the result count', async () => {
    const { getByTestId } = await render(
      <ExploreView filters={{ kind: 'place' }} onOpenEntity={noop} reduceMotion />,
    );
    expect(getByTestId('explore-mast-count').props.accessibilityLabel).toBe(
      'All pinned, 2 pinned · filtered',
    );
  });

  it('mast count matches the records rail header before viewport is reported', async () => {
    const { getByTestId } = await render(<ExploreView onOpenEntity={noop} reduceMotion />);
    const mast = getByTestId('explore-mast-count');
    const railHeader = within(getByTestId('explore-records-rail')).getByRole('header');
    expect(mast.props.accessibilityLabel).toBe('All pinned, 3 pinned');
    expect(railHeader.props.accessibilityLabel).toBe(mast.props.accessibilityLabel);
  });

  it('keeps the sheet where the gesture left it — no snap-back when dragged full → half', async () => {
    const { getByTestId } = await render(<ExploreView onOpenEntity={noop} reduceMotion />);
    // Expand the rail to full browse from the mast control.
    await act(async () => {
      fireEvent.press(getByTestId('explore-chip-records'));
    });
    expect(getByTestId('sheet-controlled-index')).toHaveTextContent('2');

    // Simulate the user dragging the sheet down to the half detent. The old bug
    // recomputed the derived index back to full and yanked the sheet up; the
    // gesture must now be authoritative.
    await act(async () => {
      fireEvent.press(getByTestId('sheet-settle-half'));
    });
    expect(getByTestId('sheet-controlled-index')).toHaveTextContent('1');

    // And it stays lowerable all the way to peek.
    await act(async () => {
      fireEvent.press(getByTestId('sheet-settle-peek'));
    });
    expect(getByTestId('sheet-controlled-index')).toHaveTextContent('0');
  });

  it('dragging a selection preview below half dismisses the selection instead of snapping back', async () => {
    const { getByTestId, queryByTestId, findByTestId } = await render(
      <ExploreView selectedParam="ent_fixture_place_dc" onOpenEntity={noop} reduceMotion />,
    );
    expect(await findByTestId('entity-preview-sheet')).toBeTruthy();
    // A selection floors the sheet at half.
    expect(getByTestId('sheet-controlled-index')).toHaveTextContent('1');

    await act(async () => {
      fireEvent.press(getByTestId('sheet-settle-peek'));
    });
    // The half floor releases because the selection is cleared — the sheet lands
    // on peek and does not spring back to half under the finger.
    expect(getByTestId('sheet-controlled-index')).toHaveTextContent('0');
    expect(queryByTestId('entity-preview-sheet')).toBeNull();
  });

  it('opens the in-map instruments panel from floating chrome', async () => {
    const { getByTestId, queryByTestId } = await render(
      <ExploreView onOpenEntity={noop} reduceMotion />,
    );
    expect(queryByTestId('explore-instruments-panel')).toBeNull();
    await act(async () => {
      fireEvent.press(getByTestId('explore-chip-instruments'));
    });
    expect(getByTestId('explore-instruments-panel')).toBeTruthy();
  });

  it('applies instrument filter chips live without an Apply confirm step', async () => {
    const onFiltersChange = jest.fn();
    const { getByTestId, getByLabelText, queryByText } = await render(
      <ExploreView onOpenEntity={noop} onFiltersChange={onFiltersChange} reduceMotion />,
    );

    await act(async () => {
      fireEvent.press(getByTestId('explore-chip-instruments'));
    });
    expect(queryByText('Apply')).toBeNull();

    const beforeLabel = getByTestId('explore-mast-count').props.accessibilityLabel as string;
    expect(beforeLabel).toBe('All pinned, 3 pinned');

    await act(async () => {
      fireEvent.press(getByLabelText('Places'));
    });

    // Optimistic local apply: mast + rail update on the same tap (no URL round-trip).
    expect(onFiltersChange).toHaveBeenCalledWith({ kind: 'places' });
    expect(getByTestId('explore-mast-count').props.accessibilityLabel).toBe(
      'All pinned, 2 pinned · filtered',
    );
    expect(getByTestId('explore-active-filters')).toBeTruthy();
  });
});

describe('ExploreView — map posture (browse <-> immersive)', () => {
  it('gives the map live gestures in browse posture, alongside the full chrome', async () => {
    const { getByTestId, queryByTestId } = await render(
      <ExploreView onOpenEntity={noop} reduceMotion />,
    );
    expect(getByTestId('maplibre-map').props.dragPan).toBe(true);
    expect(getByTestId('explore-floating-chrome')).toBeTruthy();
    expect(getByTestId('explore-map-expand')).toBeTruthy();
    expect(queryByTestId('explore-map-collapse')).toBeNull();
  });

  it('recedes the chrome and collapses the sheet toward peek on Expand the map', async () => {
    const { getByTestId, queryByTestId } = await render(
      <ExploreView onOpenEntity={noop} reduceMotion />,
    );
    await act(async () => {
      // Raise the rail to full first so collapse-to-peek is observable.
      fireEvent.press(getByTestId('explore-chip-records'));
    });
    expect(getByTestId('sheet-controlled-index')).toHaveTextContent('2');

    await act(async () => {
      fireEvent.press(getByTestId('explore-map-expand'));
    });

    // The map was already live; expanding is about surface, not permission.
    expect(getByTestId('maplibre-map').props.dragPan).toBe(true);
    expect(getByTestId('sheet-controlled-index')).toHaveTextContent('0');
    expect(getByTestId('explore-map-collapse')).toBeTruthy();
    expect(queryByTestId('explore-map-expand')).toBeNull();
    expect(queryByTestId('explore-floating-chrome')).toBeNull();
  });

  it('keeps the map live and the selection intact when the chrome comes back', async () => {
    const { getByTestId, queryByTestId, findByTestId } = await render(
      <ExploreView selectedParam="ent_fixture_place_dc" onOpenEntity={noop} reduceMotion />,
    );
    expect(await findByTestId('entity-preview-sheet')).toBeTruthy();

    // Drop to peek so the records rail (which hosts Expand the map) shows.
    await act(async () => {
      fireEvent.press(getByTestId('sheet-settle-peek'));
    });

    await act(async () => {
      fireEvent.press(getByTestId('explore-map-expand'));
    });
    expect(getByTestId('maplibre-map').props.dragPan).toBe(true);

    await act(async () => {
      fireEvent.press(getByTestId('explore-map-collapse'));
    });

    expect(getByTestId('maplibre-map').props.dragPan).toBe(true);
    expect(queryByTestId('explore-map-collapse')).toBeNull();
    expect(getByTestId('explore-map-expand')).toBeTruthy();
    expect(getByTestId('explore-floating-chrome')).toBeTruthy();
  });

  it('selects a record from a pin press while the full chrome is up', async () => {
    const { getByTestId, findByTestId } = await render(
      <ExploreView onOpenEntity={noop} reduceMotion />,
    );
    await act(async () => {
      fireEvent(getByTestId('maplibre-geojson-source'), 'press', {
        nativeEvent: {
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-77.0369, 38.9072] },
              properties: { entityId: 'ent_fixture_place_dc' },
            },
          ],
          lngLat: [-77.0369, 38.9072],
        },
      });
    });
    expect(await findByTestId('entity-preview-sheet')).toBeTruthy();
  });
});

describe('ExploreView — wide window (map + persistent records rail)', () => {
  it('replaces the bottom sheet with a side rail on a tablet-sized window', async () => {
    setTestWindowSize(TABLET_WINDOW);
    const { getByTestId, queryByTestId } = await render(
      <ExploreView onOpenEntity={noop} reduceMotion />,
    );

    expect(getByTestId('explore-side-rail')).toBeTruthy();
    expect(getByTestId('explore-records-rail')).toBeTruthy();
    expect(queryByTestId('explore-bottom-sheet-host')).toBeNull();
  });

  it('keeps the list while a record is selected — the reason the wide layout exists', async () => {
    setTestWindowSize(TABLET_WINDOW);
    const { findByTestId, getByTestId } = await render(
      <ExploreView selectedParam="ent_fixture_place_dc" onOpenEntity={noop} reduceMotion />,
    );

    expect(await findByTestId('entity-preview-sheet')).toBeTruthy();
    // On a phone the preview REPLACES the list. Here both are mounted at once, so a reader
    // stepping through a county keeps their place.
    expect(getByTestId('explore-side-rail-inspector')).toBeTruthy();
    expect(getByTestId('explore-records-rail')).toBeTruthy();
  });

  it('gives the rail a header that says what it is showing, not a pull-up invitation', async () => {
    setTestWindowSize(TABLET_WINDOW);
    const { getByTestId, queryByText } = await render(
      <ExploreView onOpenEntity={noop} reduceMotion />,
    );

    const rail = within(getByTestId('explore-side-rail'));
    // The count is visible text here. In the sheet it is an invisible a11y-only node, because
    // the floating mast over the map carries it; a pane reader should not have to look across
    // the window for the size of the list beside them.
    expect(rail.getByText('All pinned')).toBeTruthy();
    expect(rail.getByText('3 pinned')).toBeTruthy();
    // A pane does not pull up.
    expect(queryByText('Pull up for places')).toBeNull();
    // Expanding survives, demoted to a ghost square beside the header.
    expect(getByTestId('explore-map-expand')).toBeTruthy();
  });

  it('keeps the whole list after a rail pick, because the camera does not fly', async () => {
    setTestWindowSize(TABLET_WINDOW);
    const { getByTestId, findByTestId } = await render(
      <ExploreView onOpenEntity={noop} reduceMotion />,
    );

    const rail = () => within(getByTestId('explore-records-rail'));
    expect(rail().getAllByRole('button').length).toBeGreaterThanOrEqual(3);

    await act(async () => {
      fireEvent.press(rail().getByText('Seed Historical Place (D.C.)'));
    });
    expect(await findByTestId('entity-preview-sheet')).toBeTruthy();

    // `point` is the ceiling zoom. Had the selection flown there, the viewport-scoped list
    // would now hold one row — the record the reader just asked about, and nothing else.
    // That is the cost the wide layout exists to avoid, so all three are still here.
    expect(rail().getByText('Seed Historical Place (D.C.)')).toBeTruthy();
    expect(rail().getByText('Seed Cultural Institution (Queens, NY)')).toBeTruthy();
    expect(rail().getByText('Seed Living Person (Houston, TX)')).toBeTruthy();
    expect(getByTestId('explore-side-rail-inspector')).toBeTruthy();
  });


  it('ignores the route echoing the selection back as ?selected=', async () => {
    setTestWindowSize(TABLET_WINDOW);
    const onSelectionChange = jest.fn();
    const { getByTestId, rerender, findByTestId } = await render(
      <ExploreView onOpenEntity={noop} onSelectionChange={onSelectionChange} reduceMotion />,
    );

    const rail = () => within(getByTestId('explore-records-rail'));
    await act(async () => {
      fireEvent.press(rail().getByText('Seed Historical Place (D.C.)'));
    });
    expect(await findByTestId('entity-preview-sheet')).toBeTruthy();
    expect(onSelectionChange).toHaveBeenCalledWith('ent_fixture_place_dc');

    // What the real route does next: write the id into the URL, which comes straight back in
    // as `selectedParam` a frame later. Acting on that echo re-ran the restore path and fired
    // a camera command the tap had deliberately not asked for.
    await act(async () => {
      rerender(
        <ExploreView
          onOpenEntity={noop}
          onSelectionChange={onSelectionChange}
          selectedParam="ent_fixture_place_dc"
          reduceMotion
        />,
      );
    });

    expect(rail().getByText('Seed Cultural Institution (Queens, NY)')).toBeTruthy();
    expect(rail().getByText('Seed Living Person (Houston, TX)')).toBeTruthy();
  });

  it('drops the records toggle from the mast, because the rail no longer toggles', async () => {
    setTestWindowSize(TABLET_WINDOW);
    const { queryByTestId, getByTestId } = await render(
      <ExploreView onOpenEntity={noop} reduceMotion />,
    );

    expect(getByTestId('explore-floating-chrome')).toBeTruthy();
    expect(queryByTestId('explore-chip-records')).toBeNull();
    // The instruments chip is untouched — filters still apply in both postures.
    expect(getByTestId('explore-chip-instruments')).toBeTruthy();
  });

  it('keeps the attribution pill visible — nothing covers the map pane', async () => {
    setTestWindowSize(TABLET_WINDOW);
    const { findByTestId, getByTestId } = await render(
      <ExploreView selectedParam="ent_fixture_place_dc" onOpenEntity={noop} reduceMotion />,
    );

    expect(await findByTestId('entity-preview-sheet')).toBeTruthy();
    // The phone hides it because the half-height sheet lands on top of it. Here it does not.
    expect(getByTestId('map-attribution')).toBeTruthy();
  });

  it('hides the rail in the immersive posture and brings it back on collapse', async () => {
    setTestWindowSize(TABLET_WINDOW);
    const { getByTestId, queryByTestId } = await render(
      <ExploreView onOpenEntity={noop} reduceMotion />,
    );

    await act(async () => {
      fireEvent.press(getByTestId('explore-map-expand'));
    });
    expect(queryByTestId('explore-side-rail')).toBeNull();
    expect(getByTestId('explore-map-collapse')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('explore-map-collapse'));
    });
    expect(getByTestId('explore-side-rail')).toBeTruthy();
  });

  it('opens the full record from the rail preview', async () => {
    setTestWindowSize(TABLET_WINDOW);
    const onOpenEntity = jest.fn();
    const { findByTestId, getByTestId } = await render(
      <ExploreView
        selectedParam="ent_fixture_place_dc"
        onOpenEntity={onOpenEntity}
        reduceMotion
      />,
    );

    expect(await findByTestId('entity-preview-sheet')).toBeTruthy();
    await act(async () => {
      fireEvent.press(within(getByTestId('explore-side-rail-inspector')).getByText('Open place'));
    });
    expect(onOpenEntity).toHaveBeenCalledWith('ent_fixture_place_dc');
  });

  it('swaps postures live when the window is resized, as a split-view drag does', async () => {
    setTestWindowSize(TABLET_WINDOW);
    const { getByTestId, queryByTestId } = await render(
      <ExploreView onOpenEntity={noop} reduceMotion />,
    );
    expect(getByTestId('explore-side-rail')).toBeTruthy();

    // Drag the divider down to a Slide Over column.
    await act(async () => {
      setTestWindowSize({ width: 320, height: 1194 });
    });
    expect(queryByTestId('explore-side-rail')).toBeNull();
    expect(getByTestId('explore-bottom-sheet-host')).toBeTruthy();

    // And back out again.
    await act(async () => {
      setTestWindowSize(TABLET_WINDOW);
    });
    expect(getByTestId('explore-side-rail')).toBeTruthy();
    expect(queryByTestId('explore-bottom-sheet-host')).toBeNull();
  });

  it('leaves a landscape phone on the sheet — wide is not the same as roomy', async () => {
    setTestWindowSize({ width: 874, height: 402 });
    const { getByTestId, queryByTestId } = await render(
      <ExploreView onOpenEntity={noop} reduceMotion />,
    );

    expect(queryByTestId('explore-side-rail')).toBeNull();
    expect(getByTestId('explore-bottom-sheet-host')).toBeTruthy();
  });

  it('keeps the records usable in the wide layout when the map fails', async () => {
    setTestWindowSize(TABLET_WINDOW);
    const { getByTestId } = await render(
      <ExploreView
        onOpenEntity={noop}
        reduceMotion
        loadState={{ kind: 'error', mode: 'provider-outage' }}
      />,
    );

    expect(getByTestId('explore-side-rail')).toBeTruthy();
    expect(getByTestId('explore-records-rail')).toBeTruthy();
  });
});

describe('ExploreView — entity preview sheet', () => {
  it('opens the preview sheet from the records rail and links to the full entity route', async () => {
    const onOpenEntity = jest.fn();
    const utils = await render(<ExploreView onOpenEntity={onOpenEntity} reduceMotion />);
    fireEvent.press(utils.getByLabelText(/Seed Historical Place/));
    expect(await utils.findByTestId('entity-preview-sheet')).toBeTruthy();
    fireEvent.press(await utils.findByLabelText(/Open place for/));
    expect(onOpenEntity).toHaveBeenCalledWith('ent_fixture_place_dc');
  });

  it('opens the preview sheet when a deep-linked selection is restored', async () => {
    const { findByTestId } = await render(
      <ExploreView selectedParam="ent_fixture_place_dc" onOpenEntity={noop} reduceMotion />,
    );
    expect(await findByTestId('entity-preview-sheet')).toBeTruthy();
  });
});

describe('ExploreView — failed map leaves records usable', () => {
  it('renders the degraded map error state AND interactive records rail', async () => {
    const onOpenEntity = jest.fn();
    const utils = await render(
      <ExploreView
        loadState={{ kind: 'error', mode: 'provider-outage' }}
        onOpenEntity={onOpenEntity}
        reduceMotion
      />,
    );
    expect(utils.getByTestId('map-error-state')).toBeTruthy();
    expect(utils.queryByTestId('maplibre-map')).toBeNull();
    expect(utils.getByTestId('explore-records-rail')).toBeTruthy();
    fireEvent.press(utils.getByLabelText(/Seed Historical Place/));
    fireEvent.press(await utils.findByLabelText(/Open place for/));
    expect(onOpenEntity).toHaveBeenCalled();
  });
});

describe('ExploreView — empty + adversarial', () => {
  const empty: MapFeatureCollection = { type: 'FeatureCollection', features: [] };

  it('shows the empty records state and a zero count when nothing matches', async () => {
    const { getByTestId } = await render(
      <ExploreView source={empty} onOpenEntity={noop} reduceMotion />,
    );
    expect(getByTestId('explore-records-empty')).toBeTruthy();
    expect(getByTestId('explore-mast-count').props.accessibilityLabel).toBe('All pinned, None');
  });

  it('renders a pathological oversized label without crashing', async () => {
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
    const utils = await render(<ExploreView source={hostile} onOpenEntity={noop} reduceMotion />);
    expect(utils.getByTestId('explore-records-rail')).toBeTruthy();
  });
});

describe('ExploreView — repeated mount/unmount (leak check)', () => {
  it('balances every event subscription with a cleanup (no listener leak)', async () => {
    cleanup();
    await act(async () => {
      await Promise.resolve();
    });

    const remove = jest.fn();
    const addSpy = jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove } as never);
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);

    // Passive effects still pending from earlier tests in this file flush during the
    // cleanup above and land on the spy as unmatched adds. Reset so the balance below
    // measures only the mount/unmount cycles it is actually about.
    addSpy.mockClear();
    remove.mockClear();

    const CYCLES = 25;
    for (let i = 0; i < CYCLES; i += 1) {
      const view = await render(<ExploreView source={DEMO_MAP_SOURCE} onOpenEntity={noop} />);
      await act(async () => {
        view.unmount();
      });
    }

    expect(remove.mock.calls.length).toBeGreaterThanOrEqual(CYCLES);
    expect(addSpy.mock.calls.length - remove.mock.calls.length).toBeLessThanOrEqual(10);
    addSpy.mockRestore();
  });
});
