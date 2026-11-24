/**
 * SearchField: one clear control at the touch-target floor on both platforms, never the native
 * iOS glyph.
 */
import { Platform, StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { SearchField } from '../SearchField';
import { MIN_TOUCH_TARGET } from '../tokens';

jest.mock('../tokens', () => {
  const actual = jest.requireActual('../tokens');
  return { ...actual, useThemeColors: () => actual.themeColors.light };
});

describe('SearchField', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['ios', 'android'] as const)('draws its own clear button on %s', async (os) => {
    jest.replaceProperty(Platform, 'OS', os);
    const onChangeText = jest.fn();
    const { getByLabelText } = await render(
      <SearchField value="tubman" onChangeText={onChangeText} accessibilityLabel="Search themes" />,
    );

    const input = getByLabelText('Search themes');
    expect(input.props.accessibilityRole).toBe('search');
    expect(input.props.clearButtonMode).toBeUndefined();

    const clear = getByLabelText('Clear search');
    const style = StyleSheet.flatten(clear.props.style);
    expect(style.width).toBe(MIN_TOUCH_TARGET);
    expect(style.height).toBe(MIN_TOUCH_TARGET);
    fireEvent.press(clear);
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('hides the clear button while the field is empty', async () => {
    const { queryByLabelText } = await render(
      <SearchField value="" onChangeText={() => undefined} accessibilityLabel="Search themes" />,
    );
    expect(queryByLabelText('Clear search')).toBeNull();
  });
});
