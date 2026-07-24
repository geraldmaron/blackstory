/**
 * BackControl — copper chevron press target for stack / ScreenHeader back.
 */
import { fireEvent, render } from '@testing-library/react-native';

import { BackControl } from '../BackControl';

jest.mock('../tokens', () => {
  const actual = jest.requireActual('../tokens');
  return {
    ...actual,
    useThemeColors: () => actual.themeColors.light,
  };
});

describe('BackControl', () => {
  it('exposes an accessible Go back button and fires onPress', async () => {
    const onPress = jest.fn();
    const { getByLabelText } = await render(<BackControl onPress={onPress} />);
    fireEvent.press(getByLabelText('Go back'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('accepts a custom accessibility label', async () => {
    const { getByLabelText } = await render(
      <BackControl onPress={() => {}} accessibilityLabel="Close sheet" />,
    );
    expect(getByLabelText('Close sheet')).toBeTruthy();
  });
});
