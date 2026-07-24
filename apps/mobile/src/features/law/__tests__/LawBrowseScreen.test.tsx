/**
 * Smoke tests for Law browse screen.
 */
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: jest.fn(),
  },
}));

import { LawBrowseScreen } from '../LawBrowseScreen';

describe('LawBrowseScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders catalog pulse and at least one law row', async () => {
    const { getByText, getByLabelText } = await render(<LawBrowseScreen />);
    expect(getByText('Law')).toBeTruthy();
    expect(getByText('Catalog pulse')).toBeTruthy();
    expect(getByText('Not legal advice')).toBeTruthy();
    expect(getByLabelText('Search law catalog')).toBeTruthy();
    expect(getByText(/Civil Rights Act of 1964/i)).toBeTruthy();
  });

  it('pushes detail when a row is pressed', async () => {
    const { getByText } = await render(<LawBrowseScreen />);
    fireEvent.press(getByText(/Civil Rights Act of 1964/i));
    expect(mockPush).toHaveBeenCalledWith('/law/civil-rights-act-1964');
  });
});
