/**
 * MapAttribution — flat Surface chip with theme-aware muted ink (WCAG AA).
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { themeColors } from '@/ui/tokens';
import { MapAttribution } from '../MapAttribution';
import { MAP_GHOST_BG, MAP_INK_MUTED } from '../map-plate-ink';

jest.mock('@/ui/tokens', () => {
  const actual = jest.requireActual('@/ui/tokens');
  return {
    ...actual,
    useThemeColors: () => actual.themeColors.light,
  };
});

describe('MapAttribution', () => {
  it('starts collapsed with only the info toggle visible', async () => {
    const { getByTestId, queryByTestId } = await render(<MapAttribution />);
    const toggle = getByTestId('map-attribution-toggle');

    expect(queryByTestId('map-attribution-text')).toBeNull();
    expect(toggle.props.accessibilityState?.expanded).toBe(false);
    expect(toggle.props.accessibilityLabel).toContain('OpenStreetMap contributors');
  });

  it('expands attribution copy when the toggle is pressed', async () => {
    const { getByTestId, getByText } = await render(<MapAttribution />);
    const toggle = getByTestId('map-attribution-toggle');

    await act(async () => {
      fireEvent.press(toggle);
    });

    expect(getByText(/OpenStreetMap/)).toBeTruthy();
    expect(getByTestId('map-attribution-toggle').props.accessibilityState?.expanded).toBe(true);
  });

  it('uses the plate ghost fill and map ink when expanded, never an opaque surface', async () => {
    const { getByTestId, getByText } = await render(<MapAttribution />);
    await act(async () => {
      fireEvent.press(getByTestId('map-attribution-toggle'));
    });

    const chip = getByTestId('map-attribution');
    const flat = StyleSheet.flatten(chip.props.style);
    const label = StyleSheet.flatten(getByText(/OpenStreetMap/).props.style);

    // The chip sits on the dark archive plate beside Explore's other controls, which are all
    // translucent. An opaque theme surface here rendered as a solid white block — the heaviest
    // element on the map, for its least important control.
    expect(flat.backgroundColor).toBe(MAP_GHOST_BG);
    expect(flat.backgroundColor).not.toBe(themeColors.light.surface);
    expect(label.color).toBe(MAP_INK_MUTED);
  });

  it('keeps the ghost chip in compact mode with shorter copy when expanded', async () => {
    const { getByTestId, getByText, queryByText } = await render(<MapAttribution compact />);
    await act(async () => {
      fireEvent.press(getByTestId('map-attribution-toggle'));
    });

    const chip = getByTestId('map-attribution');
    const flat = StyleSheet.flatten(chip.props.style);
    const label = StyleSheet.flatten(getByText(/OpenStreetMap/).props.style);

    expect(flat.backgroundColor).toBe(MAP_GHOST_BG);
    expect(label.color).toBe(MAP_INK_MUTED);
    // Compact drops the OpenMapTiles tag so the chip does not crowd the sheet handle.
    expect(queryByText(/OpenMapTiles/)).toBeNull();
  });
});
