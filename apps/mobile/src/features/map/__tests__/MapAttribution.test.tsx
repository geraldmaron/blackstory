/**
 * MapAttribution — flat Surface chip with theme-aware muted ink (WCAG AA).
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { themeColors } from '@/ui/tokens';
import { MapAttribution } from '../MapAttribution';

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

  it('uses opaque Surface and theme muted ink when expanded', async () => {
    const { getByTestId, getByText } = await render(<MapAttribution />);
    await act(async () => {
      fireEvent.press(getByTestId('map-attribution-toggle'));
    });

    const chip = getByTestId('map-attribution');
    const flat = StyleSheet.flatten(chip.props.style);
    const label = StyleSheet.flatten(getByText(/OpenStreetMap/).props.style);

    expect(flat.backgroundColor).toBe(themeColors.light.surface);
    expect(label.color).toBe(themeColors.light.inkMuted);
  });

  it('keeps the Surface chip in compact mode with shorter copy when expanded', async () => {
    const { getByTestId, getByText, queryByText } = await render(<MapAttribution compact />);
    await act(async () => {
      fireEvent.press(getByTestId('map-attribution-toggle'));
    });

    const chip = getByTestId('map-attribution');
    const flat = StyleSheet.flatten(chip.props.style);
    const label = StyleSheet.flatten(getByText(/OpenStreetMap/).props.style);

    expect(flat.backgroundColor).toBe(themeColors.light.surface);
    expect(label.color).toBe(themeColors.light.inkMuted);
    // Compact drops the OpenMapTiles tag so the chip does not crowd the sheet handle.
    expect(queryByText(/OpenMapTiles/)).toBeNull();
  });
});
