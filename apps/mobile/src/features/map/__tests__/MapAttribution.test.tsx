/**
 * MapAttribution — flat Surface chip with theme-aware muted ink (WCAG AA).
 */
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

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
  it('uses opaque Surface and theme muted ink (not ghost rgba over tiles)', async () => {
    const { getByTestId, getByText } = await render(<MapAttribution />);
    const chip = getByTestId('map-attribution');
    const flat = StyleSheet.flatten(chip.props.style);
    const label = StyleSheet.flatten(getByText(/OpenStreetMap/).props.style);

    expect(flat.backgroundColor).toBe(themeColors.light.surface);
    expect(label.color).toBe(themeColors.light.inkMuted);
  });

  it('keeps the Surface chip in compact mode with shorter copy', async () => {
    const { getByTestId, getByText, queryByText } = await render(<MapAttribution compact />);
    const chip = getByTestId('map-attribution');
    const flat = StyleSheet.flatten(chip.props.style);
    const label = StyleSheet.flatten(getByText(/OpenStreetMap/).props.style);

    expect(flat.backgroundColor).toBe(themeColors.light.surface);
    expect(label.color).toBe(themeColors.light.inkMuted);
    // Compact drops the OpenMapTiles tag so the chip does not crowd the sheet handle.
    expect(queryByText(/OpenMapTiles/)).toBeNull();
  });
});
