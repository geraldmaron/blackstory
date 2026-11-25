/**
 * Chip: the selected state is exposed by role, and is drawn as more than a hue change.
 */
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { Chip } from '../Chip';
import { MIN_TOUCH_TARGET, themeColors } from '../tokens';

jest.mock('../tokens', () => {
  const actual = jest.requireActual('../tokens');
  return { ...actual, useThemeColors: () => actual.themeColors.light };
});

const hidden = { includeHiddenElements: true };

describe('Chip', () => {
  it('reports selected on a button, and draws the ink fill with a check', async () => {
    const { getByLabelText, getByTestId } = await render(
      <Chip label="People" selected onPress={() => undefined} />,
    );
    const chip = getByLabelText('People');
    expect(chip.props.accessibilityRole).toBe('button');
    expect(chip.props.accessibilityState).toEqual({ selected: true });
    const style = StyleSheet.flatten(chip.props.style);
    expect(style.backgroundColor).toBe(themeColors.light.ink);
    expect(style.minHeight).toBe(MIN_TOUCH_TARGET);
    expect(style.minWidth).toBe(MIN_TOUCH_TARGET);
    expect(getByTestId('chip-check', hidden)).toBeTruthy();
  });

  it('reports checked on a radio', async () => {
    const { getByLabelText } = await render(
      <Chip role="radio" label="1950s" selected onPress={() => undefined} />,
    );
    expect(getByLabelText('1950s').props.accessibilityState).toEqual({ checked: true });
  });

  it('draws no check and the control edge when unselected', async () => {
    const { getByLabelText, queryByTestId } = await render(
      <Chip label="Places" selected={false} onPress={() => undefined} />,
    );
    const chip = getByLabelText('Places');
    expect(chip.props.accessibilityState).toEqual({ selected: false });
    expect(StyleSheet.flatten(chip.props.style).borderColor).toBe(themeColors.light.borderControl);
    expect(queryByTestId('chip-check', hidden)).toBeNull();
  });
});
