import { fireEvent, render } from '@testing-library/react-native';
import { Linking, StyleSheet } from 'react-native';
import { EXTERNAL_LINK_HINT, externalLinkHint, Link } from '../Link';

describe('Link', () => {
  it('exposes accessibilityRole="link" and the visible text as the default label', async () => {
    const { getByRole } = await render(<Link href="https://blackstory.app">blackstory.app</Link>);
    const link = getByRole('link');
    expect(link.props.accessibilityLabel).toBe('blackstory.app');
  });

  it('opens the href via Linking.openURL by default', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const { getByRole } = await render(<Link href="https://blackstory.app/e/123">an entity</Link>);
    fireEvent.press(getByRole('link'));
    expect(spy).toHaveBeenCalledWith('https://blackstory.app/e/123');
    spy.mockRestore();
  });

  it('defers to a caller-supplied onPress instead of Linking when provided', async () => {
    const spy = jest.spyOn(Linking, 'openURL');
    const onPress = jest.fn();
    const { getByRole } = await render(
      <Link href="https://blackstory.app/e/123" onPress={onPress}>
        an entity
      </Link>,
    );
    fireEvent.press(getByRole('link'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('tells a screen reader that a web href leaves the app', async () => {
    const { getByRole } = await render(<Link href="https://blackstory.app">blackstory.app</Link>);
    expect(getByRole('link').props.accessibilityHint).toBe(EXTERNAL_LINK_HINT);
  });

  it('derives no browser hint when the caller decides the destination, or for a non-web href', async () => {
    const withPress = await render(
      <Link href="https://blackstory.app/methodology" onPress={() => {}}>
        Methodology
      </Link>,
    );
    expect(withPress.getByRole('link').props.accessibilityHint).toBeUndefined();
    expect(externalLinkHint('blackstory://entity/1')).toBeUndefined();
    expect(externalLinkHint(' HTTP://example.org ')).toBe(EXTERNAL_LINK_HINT);
  });

  it('lets the caller override the derived hint', async () => {
    const { getByRole } = await render(
      <Link href="https://example.org" accessibilityHint="Opens the county register">
        Register
      </Link>,
    );
    expect(getByRole('link').props.accessibilityHint).toBe('Opens the county register');
  });

  it('draws a box at least 44pt tall rather than relying on an invisible hitSlop', async () => {
    const { getByRole } = await render(<Link href="https://blackstory.app">blackstory.app</Link>);
    const link = getByRole('link');
    const style = StyleSheet.flatten(
      typeof link.props.style === 'function'
        ? link.props.style({ pressed: false })
        : link.props.style,
    );
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });
});
