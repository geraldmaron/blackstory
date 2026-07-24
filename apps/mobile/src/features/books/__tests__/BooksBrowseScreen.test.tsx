/**
 * Smoke tests for Banned books browse screen.
 */
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: jest.fn(),
  },
}));

import { BooksBrowseScreen } from '../BooksBrowseScreen';

describe('BooksBrowseScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders catalog pulse and at least one title row', async () => {
    const { getByText, getByLabelText } = await render(<BooksBrowseScreen />);
    expect(getByText('Banned books')).toBeTruthy();
    expect(getByText('Catalog pulse')).toBeTruthy();
    expect(getByLabelText('Search banned books')).toBeTruthy();
    expect(getByText(/The Bluest Eye/i)).toBeTruthy();
  });

  it('pushes detail when a row is pressed', async () => {
    const { getByText } = await render(<BooksBrowseScreen />);
    fireEvent.press(getByText(/The Bluest Eye/i));
    expect(mockPush).toHaveBeenCalledWith('/books/the-bluest-eye');
  });
});
