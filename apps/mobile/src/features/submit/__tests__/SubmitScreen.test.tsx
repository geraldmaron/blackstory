/**
 * Smoke tests for native Submit shell.
 */
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: jest.fn(),
  },
}));

import { SubmitScreen } from '../SubmitScreen';

describe('SubmitScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('offers native corrections as the primary path', async () => {
    const { getByText } = await render(<SubmitScreen />);
    expect(getByText('Submit')).toBeTruthy();
    expect(getByText('Two different lanes')).toBeTruthy();
    fireEvent.press(getByText('Open corrections form'));
    expect(mockPush).toHaveBeenCalledWith('/corrections/submit');
  });

  it('keeps lead intake as an explicit web secondary action', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const { getByText } = await render(<SubmitScreen />);
    fireEvent.press(getByText('Open lead form on web'));
    expect(spy).toHaveBeenCalledWith('https://blackbook.app/submit');
    spy.mockRestore();
  });
});
