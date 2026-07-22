import { fireEvent, render } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { Link } from '../Link';

describe('Link', () => {
  it('exposes accessibilityRole="link" and the visible text as the default label', async () => {
    const { getByRole } = await render(<Link href="https://blackbook.app">blackbook.app</Link>);
    const link = getByRole('link');
    expect(link.props.accessibilityLabel).toBe('blackbook.app');
  });

  it('opens the href via Linking.openURL by default', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const { getByRole } = await render(<Link href="https://blackbook.app/e/123">an entity</Link>);
    fireEvent.press(getByRole('link'));
    expect(spy).toHaveBeenCalledWith('https://blackbook.app/e/123');
    spy.mockRestore();
  });

  it('defers to a caller-supplied onPress instead of Linking when provided', async () => {
    const spy = jest.spyOn(Linking, 'openURL');
    const onPress = jest.fn();
    const { getByRole } = await render(
      <Link href="https://blackbook.app/e/123" onPress={onPress}>
        an entity
      </Link>,
    );
    fireEvent.press(getByRole('link'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
